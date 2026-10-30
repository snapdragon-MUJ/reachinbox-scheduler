import { Client } from '@elastic/elasticsearch';
import { prisma } from '../lib/prisma';

export const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
});

const INDEX_NAME = 'emails';

export async function initElasticsearch() {
  try {
    const exists = await esClient.indices.exists({ index: INDEX_NAME });
    if (!exists) {
      await esClient.indices.create({ index: INDEX_NAME });
    }
  } catch (err) {}
}

export async function indexEmailInES(email: any) {
  try {
    await esClient.index({
      index: INDEX_NAME,
      id: email.id,
      document: email,
    });
  } catch (err) {}
}

export async function searchEmails(query: string, userId: string) {
  try {
    const result = await esClient.search({
      index: INDEX_NAME,
      query: {
        multi_match: {
          query,
          fields: ['recipient', 'subject', 'body'],
        },
      },
    });
    return result.hits.hits.map((h) => h._source);
  } catch (err) {
    return await prisma.scheduledEmail.findMany({
      where: {
        userId,
        OR: [
          { recipient: { contains: query, mode: 'insensitive' } },
          { subject: { contains: query, mode: 'insensitive' } },
          { body: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
