import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
dotenv.config();

import channelRoutes from './routes/channel.routes';
import playlistRoutes from './routes/playlist.routes';
import syncRoutes from './routes/sync.routes';
import videoRoutes from './routes/video.routes';
import dictionaryRoutes from './routes/dictionary.routes';
import parserRoutes from './routes/parser.routes';
import { runScheduler } from './services/sync.service';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Health check route
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
app.use('/api/channels', channelRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/dictionary', dictionaryRoutes);
app.use('/api/parser', parserRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Start the sync scheduler
  runScheduler();
});

export default app;
