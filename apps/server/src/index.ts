import http from 'http';
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
import requestsRoutes from './routes/requests.routes';
import configRoutes from './routes/config.routes';
import settingsRoutes from './routes/settings.routes';
import { requestLogger } from './middleware/requestLogger';
import filesRoutes from './routes/files.routes';
import videoListsRoutes from './routes/video-lists.routes';
import kpopDictionaryRoutes from './routes/kpop-dictionary.routes';
import { syncService } from './services/sync.service';
import { kpopDictionaryService } from './services/kpopDictionary.service';
import { assertParserStrategy } from '@vidpulse/parser';
import healthRoutes from './routes/health.routes';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';
import { config, validateConfig } from './config';
import { resetConfig, resolveConfigPath } from '@vidpulse/config';
import { createConfigWatcher, performRestart } from './services/configWatcher.service';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(morgan('dev'));
  app.use(requestLogger);
  app.use(express.json());

  app.use('/api/health', healthRoutes);
  app.use('/api/config', configRoutes);
  app.use('/api/requests', requestsRoutes);

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

/** The running HTTP server, kept so a config-reload can close and re-listen it (in-process restart). */
let server: http.Server | null = null;

/** Boot (or re-boot) the server + schedulers from the current config. Port and parser strategy are
 *  re-read here, so a config reload picks up their new values. */
function startServer(): void {
  validateConfig();
  const parserStrategy = assertParserStrategy(config.parser.strategy);
  const { app } = createApp();
  server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
    console.log(`Active parser strategy: ${parserStrategy}`);
    syncService.runScheduler();
    kpopDictionaryService.runScheduler();
  });
}

/** Tear down the schedulers and the HTTP server so the process can re-listen on a fresh config. */
async function stopServer(): Promise<void> {
  syncService.stopScheduler();
  kpopDictionaryService.stopScheduler();
  const s = server;
  server = null;
  if (s) await new Promise<void>((resolve) => s.close(() => resolve()));
}

if (require.main === module) {
  startServer();

  if (config.watchConfig) {
    const watcher = createConfigWatcher({
      path: resolveConfigPath(),
      onChange: () =>
        performRestart({
          reload: () => {
            resetConfig();
            validateConfig();
          },
          stop: stopServer,
          start: startServer,
          logger: console,
        }),
      logger: console,
    });
    watcher.start();
  }
}
