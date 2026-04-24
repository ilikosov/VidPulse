import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// Path to kpop_dict.json
const DICT_PATH = path.join(__dirname, '../../data/kpop_dict.json');

/**
 * GET /api/dictionary?type=groups|artists|songs|events
 * Returns matching items from the dictionary based on query param
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const type = req.query.type as string | undefined;
    const query = (req.query.q as string | undefined)?.toLowerCase() || '';

    if (!type) {
      return res.status(400).json({ error: 'Missing required query parameter: type' });
    }

    // Read dictionary file
    if (!fs.existsSync(DICT_PATH)) {
      return res.status(500).json({ error: 'Dictionary file not found' });
    }

    const dictData = JSON.parse(fs.readFileSync(DICT_PATH, 'utf-8'));

    let results: string[] = [];

    switch (type) {
      case 'groups':
        results = dictData.groups || [];
        break;
      case 'artists':
        // For artists, we can return all artist names from all groups
        const artistsDict = dictData.artists || {};
        results = Object.values(artistsDict).flat() as string[];
        break;
      case 'songs':
        results = dictData.songs || [];
        break;
      case 'events':
        results = dictData.events || [];
        break;
      default:
        return res
          .status(400)
          .json({
            error: `Invalid type: ${type}. Valid types are: groups, artists, songs, events`,
          });
    }

    // Filter by query if provided
    if (query) {
      results = results.filter((item) => item.toLowerCase().includes(query));
    }

    // Limit results to 50 for performance
    results = results.slice(0, 50);

    res.json({ results, type, query });
  } catch (error) {
    console.error('Error fetching dictionary:', error);
    res.status(500).json({ error: 'Failed to fetch dictionary' });
  }
});

export default router;
