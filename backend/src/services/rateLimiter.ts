import { redisConnection } from '../queue/emailQueue';

export async function checkAndIncrementRateLimit(sender: string, limit: number) {
  const currentHour = new Date();
  currentHour.setMinutes(0, 0, 0, 0);
  const hourKey = `ratelimit:${sender}:${currentHour.getTime()}`;

  const pipeline = redisConnection.pipeline();
  pipeline.incr(hourKey);
  pipeline.pttl(hourKey);
  const results = await pipeline.exec();

  const count = (results?.[0]?.[1] as number) || 1;
  let ttl = results?.[1]?.[1] as number;

  if (ttl === -1 || ttl < 0) {
    await redisConnection.pexpire(hourKey, 3600 * 1000);
    ttl = 3600 * 1000;
  }

  return {
    allowed: count <= limit,
    resetTime: currentHour.getTime() + 3600 * 1000,
  };
}
