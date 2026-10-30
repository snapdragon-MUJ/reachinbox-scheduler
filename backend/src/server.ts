import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from './queue/emailQueue';
import { emailWorker } from './queue/emailWorker';
import { initElasticsearch, searchEmails } from './services/searchService';
import { prisma } from './lib/prisma';
import { exchangeSlackCode } from './services/slackService';

const app = express();
app.use(cors());
app.use(express.json());

// Keep worker active and log lifecycle
emailWorker.on('ready', () => {
  console.log('? Email worker active and connected to Upstash');
});

emailWorker.on('completed', (job) => {
  console.log(`? Completed job ${job.id}`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`? Job ${job?.id} failed:`, err.message);
});

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(emailQueue, {
      readOnlyMode: false,
    })
  ],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

app.post('/api/schedule', async (req, res) => {
  try {
    const { userId, senderEmail: rawSenderEmail, recipients, subject, body, scheduledFor, minDelayMs, hourlyLimit } = req.body;
    const senderEmail = rawSenderEmail || ((userId && userId.includes("@")) ? userId : "noreply@reachinbox.ai");
    const targetDate = scheduledFor ? new Date(scheduledFor) : new Date();
    const now = Date.now();
    const initialDelay = Math.max(0, targetDate.getTime() - now);

    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email: `${userId}@reachinbox.demo` }
    });

    const jobIds = [];
    for (let i = 0; i < recipients.length; i++) {
      const jobDelay = initialDelay + i * (minDelayMs || 0);
      const emailRecord = await prisma.scheduledEmail.create({
        data: {
          userId,
          senderEmail,
          recipient: recipients[i],
          subject,
          body,
          scheduledFor: new Date(now + jobDelay),
          status: 'SCHEDULED',
        },
      });

      const job = await emailQueue.add(
        'send-email',
        {
          emailRecordId: emailRecord.id,
          userId,
          senderEmail,
          recipient: recipients[i],
          subject,
          body,
          minDelayMs: minDelayMs || 0,
          hourlyLimit: hourlyLimit || 200,
        },
        {
          delay: jobDelay,
          jobId: emailRecord.id,
        }
      );
      jobIds.push(job.id);
    }
    res.json({ success: true, count: jobIds.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/emails', async (req, res) => {
  const { status, userId } = req.query;
  const emails = await prisma.scheduledEmail.findMany({
    where: {
      userId: userId as string,
      status: status ? (status as any) : undefined,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(emails);
});

app.get('/api/emails/search', async (req, res) => {
  const { q, userId } = req.query;
  const hits = await searchEmails(q as string, (userId as string) || 'default_user');
  res.json(hits);
});

app.get('/api/slack/oauth/callback', async (req, res) => {
  const { code, state } = req.query;
  if (code && state) {
    await exchangeSlackCode(code as string, state as string);
    return res.redirect('http://localhost:3000/dashboard?slack=connected');
  }
  res.status(400).send('Invalid Slack parameters');
});

initElasticsearch();
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend server running on http://localhost:${PORT}`));
