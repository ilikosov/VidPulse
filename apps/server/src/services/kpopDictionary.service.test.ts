import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { knex } from '@vidpulse/db';

const TAG = 'KPOP-REFRESH-TEST';

// Mock the external source so refresh() imports a fixed snapshot (no network).
// The factory runs hoisted (before module-level consts), so it must not reference TAG.
const { snapshot } = vi.hoisted(() => {
  const tag = 'KPOP-REFRESH-TEST';
  return {
    snapshot: {
      version: 1 as const,
      mode: 'merge' as const,
      groups: [
        {
          name: `${tag} GROUP`,
          type: 'female' as const,
          active: true,
          aliases: [`${tag}-KO`],
          artists: [
            {
              name: `${tag} MEMBER`,
              aliases: [`${tag}-MEMBER-KO`],
              membership: {
                activityType: 'group' as const,
                status: 'active' as const,
                isPrimary: true,
              },
            },
          ],
        },
      ],
      soloArtists: [],
      events: [],
    },
  };
});

vi.mock('@vidpulse/kpop-sources', () => ({
  buildKpopLibrary: vi.fn(async () => structuredClone(snapshot)),
}));

import { kpopDictionaryService, LAST_REFRESHED_SETTING } from './kpopDictionary.service';

async function cleanup() {
  await knex('dictionary_groups').where('name', `${TAG} GROUP`).del();
  await knex('event_log').where('event_type', 'kpop_dictionary_refreshed').del();
  await knex('settings').where('key', LAST_REFRESHED_SETTING).del();
}

describe('KpopDictionaryService.refresh', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('imports the source snapshot into the dictionary and records the run', async () => {
    const summary = await kpopDictionaryService.refresh();

    // Group + artist + aliases landed in the dictionary.
    const group = await knex('dictionary_groups').where('name', `${TAG} GROUP`).first();
    expect(group).toBeTruthy();
    expect(group.type).toBe('female');

    const artist = await knex('dictionary_artists').where('name', `${TAG} MEMBER`).first();
    expect(artist).toBeTruthy();

    const groupAlias = await knex('dictionary_aliases')
      .where({ entity_type: 'group', entity_id: group.id, alias: `${TAG}-KO` })
      .first();
    expect(groupAlias).toBeTruthy();

    // Summary reflects the inserts.
    expect(summary.groups.inserted).toBeGreaterThanOrEqual(1);
    expect(summary.artists.inserted).toBeGreaterThanOrEqual(1);

    // Run is logged and timestamped.
    const event = await knex('event_log').where('event_type', 'kpop_dictionary_refreshed').first();
    expect(event).toBeTruthy();
    const lastRefreshed = await knex('settings').where('key', LAST_REFRESHED_SETTING).first();
    expect(lastRefreshed?.value).toBeTruthy();
  });

  it('rejects replace mode when dangerous actions are disabled', async () => {
    await expect(kpopDictionaryService.refresh({ mode: 'replace' })).rejects.toThrow(/disabled/i);
  });
});
