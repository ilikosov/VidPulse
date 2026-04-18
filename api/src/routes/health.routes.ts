import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma, redis } from '../index';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  fastify.get('/ready', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check database connection
      await prisma.$queryRaw`SELECT 1`;
      
      // Check Redis connection
      await redis.ping();
      
      return { status: 'ready', database: 'ok', redis: 'ok' };
    } catch (error) {
      reply.status(503);
      return { status: 'not ready', error: error.message };
    }
  });

  fastify.get('/live', async (request: FastifyRequest, reply: FastifyReply) => {
    return { status: 'live' };
  });
}