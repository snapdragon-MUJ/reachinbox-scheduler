import axios from 'axios';
import { prisma } from '../lib/prisma';

export async function exchangeSlackCode(code: string, userId: string) {
  try {
    const res = await axios.post('https://slack.com/api/oauth.v2.access', null, {
      params: {
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: process.env.SLACK_REDIRECT_URI,
      },
    });
    if (res.data.ok) {
      await prisma.user.upsert({
        where: { id: userId },
        update: { slackWebhook: res.data.incoming_webhook?.url },
        create: { id: userId, email: `${userId}@reachinbox.demo`, slackWebhook: res.data.incoming_webhook?.url }
      });
      return true;
    }
  } catch (e) {
    console.error('Slack OAuth error:', e);
  }
  return false;
}

export async function notifySlackRateLimit(userId: string, sender: string, limit: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.slackWebhook) return;

  await axios.post(user.slackWebhook, {
    text: `?? *Hourly Rate Limit Breached*\nSender \`${sender}\` exceeded limit of ${limit} emails/hr. Pending jobs delayed to next hour.`
  }).catch(() => {});
}
