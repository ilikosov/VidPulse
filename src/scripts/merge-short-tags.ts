import knex from '../db';
import { mergeShortTags } from '../services/tag.service';

mergeShortTags()
  .then(async (summary) => {
    console.log(JSON.stringify(summary, null, 2));
    await knex.destroy();
  })
  .catch(async (error: unknown) => {
    console.error('Merge short tags failed:', error);
    await knex.destroy();
    process.exit(1);
  });
