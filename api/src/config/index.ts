import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  // Server
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default('0.0.0.0'),
  }),
  
  // Database
  database: z.object({
    url: z.string().url(),
  }),
  
  // Redis
  redis: z.object({
    url: z.string().default('redis://localhost:6379'),
  }),
  
  // YouTube API
  youtube: z.object({
    apiKey: z.string(),
    baseUrl: z.string().default('https://www.googleapis.com/youtube/v3'),
  }),
  
  // LLM (OpenAI)
  llm: z.object({
    apiKey: z.string().optional(),
    model: z.string().default('gpt-4-turbo-preview'),
    temperature: z.number().default(0.1),
  }),
  
  // CORS
  cors: z.object({
    origins: z.array(z.string()).default(['http://localhost:3001']),
  }),
  
  // Rate limiting
  rateLimit: z.object({
    max: z.number().default(100),
    window: z.string().default('1 minute'),
  }),
  
  // Swagger
  swagger: z.object({
    host: z.string().default('localhost:3000'),
  }),
  
  // Logging
  logger: z.object({
    level: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    transport: z.object({
      target: z.string().default('pino-pretty'),
      options: z.object({
        colorize: z.boolean().default(true),
      }).optional(),
    }).optional(),
  }),
  
  // Worker
  worker: z.object({
    concurrency: z.number().default(5),
  }),
});

const rawConfig = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/vidpulse',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY || '',
    baseUrl: process.env.YOUTUBE_API_BASE_URL || 'https://www.googleapis.com/youtube/v3',
  },
  llm: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.1'),
  },
  cors: {
    origins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3001'],
  },
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    window: process.env.RATE_LIMIT_WINDOW || '1 minute',
  },
  swagger: {
    host: process.env.SWAGGER_HOST || 'localhost:3000',
  },
  logger: {
    level: (process.env.LOG_LEVEL as any) || 'info',
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: { colorize: true },
    } : undefined,
  },
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
  },
};

export const config = configSchema.parse(rawConfig);

export type Config = z.infer<typeof configSchema>;