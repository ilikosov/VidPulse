import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';

import { videoRoutes } from './routes/video.routes';
import { channelRoutes } from './routes/channel.routes';
import { adminRoutes } from './routes/admin.routes';
import { healthRoutes } from './routes/health.routes';
import { config } from './config';

// Initialize database client
export const prisma = new PrismaClient();

// Initialize Redis client
export const redis = new Redis(config.redis.url);

// Create Fastify server
const server = Fastify({
  logger: config.logger,
});

// Register plugins
server.register(cors, {
  origin: config.cors.origins,
  credentials: true,
});

server.register(helmet);

server.register(rateLimit, {
  max: config.rateLimit.max,
  timeWindow: config.rateLimit.window,
});

server.register(swagger, {
  swagger: {
    info: {
      title: 'VidPulse API',
      description: 'YouTube video synchronization and classification service',
      version: '0.1.0',
    },
    host: config.swagger.host,
    schemes: ['http', 'https'],
    consumes: ['application/json'],
    produces: ['application/json'],
  },
});

server.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
  },
});

// Register routes
server.register(videoRoutes, { prefix: '/api/v1/videos' });
server.register(channelRoutes, { prefix: '/api/v1/channels' });
server.register(adminRoutes, { prefix: '/api/v1/admin' });
server.register(healthRoutes, { prefix: '/health' });

// Graceful shutdown
const shutdown = async () => {
  server.log.info('Shutting down server...');
  await server.close();
  await prisma.$disconnect();
  await redis.quit();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
const start = async () => {
  try {
    await server.listen({ port: config.server.port, host: config.server.host });
    server.log.info(`Server listening on ${config.server.host}:${config.server.port}`);
    server.log.info(`API documentation available at http://${config.server.host}:${config.server.port}/docs`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();