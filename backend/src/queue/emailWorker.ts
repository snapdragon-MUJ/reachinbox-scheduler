import dotenv from 'dotenv';
dotenv.config();

import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { redisConnection, EMAIL_QUEUE_NAME } from './emailQueue';
import { prisma } from '../lib/prisma';
import { checkAndIncrementRateLimit } from '../services/rateLimiter';
import { notifySlackRateLimit } from '../services/slackService';
import { indexEmailInES } from '../services/searchService';

let cachedTransporter: nodemailer.Transporter | null = null;

async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  if (process.env.ETHEREAL_USER && process.env.ETHEREAL_USER !== 'ethereal_user') {
    cachedTransporter = nodemailer.createTransport({
      host: process.env.ETHEREAL_HOST || 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: process.env.ETHEREAL_USER,
        pass: process.env.ETHEREAL_PASS,
      },
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    console.log(`Generated Ethereal account: ${testAccount.user}`);
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }
  return cachedTransporter;
}

export const emailWorker = new Worker(
  EMAIL_QUEUE_NAME,
  async (job: Job) => {
    const { emailRecordId, senderEmail, recipient, subject, body, userId, hourlyLimit, minDelayMs } = job.data;

    if (minDelayMs > 0) {
      await new Promise((r) => setTimeout(r, minDelayMs));
    }

    const rateCheck = await checkAndIncrementRateLimit(senderEmail, hourlyLimit || 200);

    if (!rateCheck.allowed) {
      const delay = Math.max(1000, rateCheck.resetTime - Date.now());
      await prisma.scheduledEmail.update({
        where: { id: emailRecordId },
        data: { status: 'RATE_LIMITED' },
      });
      await notifySlackRateLimit(userId, senderEmail, hourlyLimit || 200);
      await job.moveToDelayed(Date.now() + delay, job.token);
      return;
    }

    await prisma.scheduledEmail.update({
      where: { id: emailRecordId },
      data: { status: 'PROCESSING' },
    });

    const transporter = await getTransporter();

    const info = await transporter.sendMail({
      from: senderEmail,
      to: recipient,
      subject,
      text: body,
    });

    console.log(`Email dispatched to ${recipient}. Preview URL: ${nodemailer.getTestMessageUrl(info)}`);

    const updated = await prisma.scheduledEmail.update({
      where: { id: emailRecordId },
      data: { status: 'SENT', sentAt: new Date() },
    });

    await indexEmailInES(updated);
  },
  {
    connection: redisConnection,
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  }
);
