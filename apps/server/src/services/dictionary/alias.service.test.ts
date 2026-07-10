import { afterEach, describe, expect, it } from 'vitest';
import { knex } from '@vidpulse/db';
import { aliasService } from './alias.service';

// Regression: aliases had no "primary" concept — the entity's canonical name/title was the only
// thing ever displayed. setPrimaryAlias lets one alias per entity override the display name
// (see docs/adr/0002-raw-parse-vs-canonical-display.md); at most one primary per entity is
// enforced by a partial unique index (packages/db/migrations/20260710000000_add_alias_is_primary.ts).

const TAG = 'alias-primary-test';
const GROUP = `${TAG} GROUP`;

async function cleanup() {
  const group = await knex('dictionary_groups').where('name', GROUP).first();
  if (group) {
    await knex('dictionary_aliases').where({ entity_type: 'group', entity_id: group.id }).del();
    await knex('dictionary_groups').where({ id: group.id }).del();
  }
}

describe('alias.service — primary alias', () => {
  afterEach(cleanup);

  it('getAliases returns is_primary and orders the primary alias first', async () => {
    const [groupId] = await knex('dictionary_groups').insert({
      name: GROUP,
      type: 'female',
      active: true,
    });
    const [zAliasId] = await knex('dictionary_aliases').insert({
      entity_type: 'group',
      entity_id: groupId,
      alias: 'ZZZ Alias',
    });
    await knex('dictionary_aliases').insert({
      entity_type: 'group',
      entity_id: groupId,
      alias: 'AAA Alias',
    });
    await aliasService.setPrimaryAlias('group', groupId, zAliasId, true);

    const aliases = await aliasService.getAliases('group', groupId);
    expect(aliases[0]).toMatchObject({ id: zAliasId, alias: 'ZZZ Alias', is_primary: true });
    expect(aliases[1]).toMatchObject({ alias: 'AAA Alias', is_primary: false });
  });

  it('setting a new primary alias unsets the previous one', async () => {
    const [groupId] = await knex('dictionary_groups').insert({
      name: GROUP,
      type: 'female',
      active: true,
    });
    const [aliasA] = await knex('dictionary_aliases').insert({
      entity_type: 'group',
      entity_id: groupId,
      alias: 'Alias A',
    });
    const [aliasB] = await knex('dictionary_aliases').insert({
      entity_type: 'group',
      entity_id: groupId,
      alias: 'Alias B',
    });

    await aliasService.setPrimaryAlias('group', groupId, aliasA, true);
    let aliases = await aliasService.getAliases('group', groupId);
    expect(aliases.find((a) => a.id === aliasA)?.is_primary).toBe(true);

    await aliasService.setPrimaryAlias('group', groupId, aliasB, true);
    aliases = await aliasService.getAliases('group', groupId);
    expect(aliases.find((a) => a.id === aliasA)?.is_primary).toBe(false);
    expect(aliases.find((a) => a.id === aliasB)?.is_primary).toBe(true);
  });

  it('unsetting the primary alias reverts to no primary', async () => {
    const [groupId] = await knex('dictionary_groups').insert({
      name: GROUP,
      type: 'female',
      active: true,
    });
    const [aliasId] = await knex('dictionary_aliases').insert({
      entity_type: 'group',
      entity_id: groupId,
      alias: 'Alias A',
    });

    await aliasService.setPrimaryAlias('group', groupId, aliasId, true);
    await aliasService.setPrimaryAlias('group', groupId, aliasId, false);

    const aliases = await aliasService.getAliases('group', groupId);
    expect(aliases[0]).toMatchObject({ is_primary: false });
  });

  it('returns null when the alias does not belong to the given entity', async () => {
    const [groupId] = await knex('dictionary_groups').insert({
      name: GROUP,
      type: 'female',
      active: true,
    });
    const result = await aliasService.setPrimaryAlias('group', groupId, 999999, true);
    expect(result).toBeNull();
  });
});
