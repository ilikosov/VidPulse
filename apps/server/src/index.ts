import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
dotenv.config();

import channelRoutes from './routes/channel.routes';
import playlistRoutes from './routes/playlist.routes';
import { createSyncRouter } from './routes/sync.routes';
import videoRoutes from './routes/video.routes';
import dictionaryRoutes from './routes/dictionary.routes';
import parserRoutes from './routes/parser.routes';
import eventsRoutes from './routes/events.routes';
import settingsRoutes from './routes/settings.routes';
import videoListsRoutes from './routes/video-lists.routes';
import { createAppContainer } from './compositionRoot';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { config, validateConfig } from './config';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/channels', channelRoutes);
  app.use('/api/playlists', playlistRoutes);
  const container = createAppContainer();
  app.use('/api/sync', createSyncRouter(container.syncService));
  app.use('/api/videos', videoRoutes);
  app.use('/api/dictionary', dictionaryRoutes);
  app.use('/api/parser', parserRoutes);
  app.use('/api/events', eventsRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/video-lists', videoListsRoutes);

  app.use('/api/*path', notFoundHandler);
  app.use(errorHandler);

  return { app, container };
}

if (require.main === module) {
  validateConfig();
  const { app, container } = createApp();
  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    container.syncService.runScheduler();
  });
}
