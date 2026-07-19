import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import channelRoutes from './routes/channel.routes';
import playlistRoutes from './routes/playlist.routes';
import syncRoutes from './routes/sync.routes';
import videoRoutes from './routes/video';
import dictionaryRoutes from './routes/dictionary.routes';
import parserRoutes from './routes/parser.routes';
import eventsRoutes from './routes/events.routes';
import errorsRoutes from './routes/errors.routes';
import settingsRoutes from './routes/settings.routes';
import filesRoutes from './routes/files.routes';
import videoListsRoutes from './routes/video-lists.routes';
import kpopDictionaryRoutes from './routes/kpop-dictionary.routes';
import { syncService } from './services/sync.service';
import { kpopDictionaryService } from './services/kpopDictionary.service';
import { assertParserStrategy } from '@vidpulse/parser';
import healthRoutes from './routes/health.routes';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { config, validateConfig } from './config';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json());

  app.use('/api/health', healthRoutes);

  app.use('/api/channels', channelRoutes);
  app.use('/api/playlists', playlistRoutes);
  app.use('/api/sync', syncRoutes);
  app.use('/api/videos', videoRoutes);
  app.use('/api/dictionary', dictionaryRoutes);
  app.use('/api/parser', parserRoutes);
  app.use('/api/events', eventsRoutes);
  app.use('/api/errors', errorsRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/files', filesRoutes);
  app.use('/api/video-lists', videoListsRoutes);
  app.use('/api/kpop-dictionary', kpopDictionaryRoutes);

  app.use('/api/*path', notFoundHandler);
  app.use(errorHandler);

  return { app };
}

if (require.main === module) {
  validateConfig();
  const parserStrategy = assertParserStrategy(config.parser.strategy);
  const { app } = createApp();
  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`Active parser strategy: ${parserStrategy}`);
    syncService.runScheduler();
    kpopDictionaryService.runScheduler();
  });
}
