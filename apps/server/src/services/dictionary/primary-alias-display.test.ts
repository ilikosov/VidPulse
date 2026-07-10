import { afterEach, describe, expect, it } from 'vitest';
import { knex } from '@vidpulse/db';
import { groupService } from './group.service';
import { artistService } from './artist.service';
import { songService } from './song.service';
import { eventService } from './event.service';

// A primary alias overrides the entity's canonical name/title for display (`display_name`), but
// never touches the canonical column itself (see docs/adr/0002-raw-parse-vs-canonical-display.md
// and the pluggable-parser-style ADR for the alias primary flag). Covers all four dictionary
// entity types, which share the same alias mechanism.

const TAG = 'primary-alias-display-test';

async function insertPrimaryAlias(entityType: string, entityId: number, alias: string) {
  await knex('dictionary_aliases').insert({
    entity_type: entityType,
    entity_id: entityId,
    alias,
    is_primary: true,
  });
}

describe('primary alias overrides display_name', () => {
  afterEach(async () => {
    await knex('dictionary_aliases').where('alias', 'like', `${TAG}%`).del();
    await knex('dictionary_songs').where('title', 'like', `${TAG}%`).del();
    await knex('dictionary_artists').where('name', 'like', `${TAG}%`).del();
    await knex('dictionary_events').where('name', 'like', `${TAG}%`).del();
    await knex('dictionary_groups').where('name', 'like', `${TAG}%`).del();
  });

  it('group: getGroups/getGroupById expose display_name only when a primary alias is set', async () => {
    const [groupId] = await knex('dictionary_groups').insert({
      name: `${TAG} GROUP`,
      type: 'female',
      active: true,
    });

    let byId = await groupService.getGroupById(groupId);
    expect(byId?.display_name).toBeNull();
    let list = await groupService.getAllGroups();
    expect(list.find((g) => g.id === groupId)?.display_name).toBeNull();

    await insertPrimaryAlias('group', groupId, `${TAG} Stage Name`);

    byId = await groupService.getGroupById(groupId);
    expect(byId?.display_name).toBe(`${TAG} Stage Name`);
    expect(byId?.name).toBe(`${TAG} GROUP`); // canonical name untouched
    list = await groupService.getAllGroups();
    expect(list.find((g) => g.id === groupId)?.display_name).toBe(`${TAG} Stage Name`);
  });

  it('artist: getArtists/getArtistById expose display_name only when a primary alias is set', async () => {
    const [groupId] = await knex('dictionary_groups').insert({
      name: `${TAG} ARTIST GROUP`,
      type: 'female',
      active: true,
    });
    const [artistId] = await knex('dictionary_artists').insert({
      name: `${TAG} ARTIST`,
      group_id: groupId,
    });

    let byId = await artistService.getArtistById(artistId);
    expect(byId?.display_name).toBeNull();

    await insertPrimaryAlias('artist', artistId, `${TAG} Alt Name`);

    byId = await artistService.getArtistById(artistId);
    expect(byId?.display_name).toBe(`${TAG} Alt Name`);
    expect(byId?.name).toBe(`${TAG} ARTIST`);
    const list = await artistService.getAllArtists();
    expect(list.find((a) => a.id === artistId)?.display_name).toBe(`${TAG} Alt Name`);
  });

  it('song: getSongs/getSongById expose display_name only when a primary alias is set', async () => {
    const [songId] = await knex('dictionary_songs').insert({
      title: `${TAG} SONG`,
      artist: `${TAG} ARTIST`,
    });

    let byId = await songService.getSongById(songId);
    expect(byId?.display_name).toBeNull();

    await insertPrimaryAlias('song', songId, `${TAG} Alt Title`);

    byId = await songService.getSongById(songId);
    expect(byId?.display_name).toBe(`${TAG} Alt Title`);
    expect(byId?.title).toBe(`${TAG} SONG`);
    const list = await songService.getAllSongs();
    expect(list.find((s) => s.id === songId)?.display_name).toBe(`${TAG} Alt Title`);
  });

  it('event: getEvents exposes display_name only when a primary alias is set', async () => {
    const [eventId] = await knex('dictionary_events').insert({ name: `${TAG} EVENT` });

    let events = await eventService.getAllEvents();
    expect(events.find((e) => e.id === eventId)?.display_name).toBeNull();

    await insertPrimaryAlias('event', eventId, `${TAG} Alt Event Name`);

    events = await eventService.getAllEvents();
    const row = events.find((e) => e.id === eventId);
    expect(row?.display_name).toBe(`${TAG} Alt Event Name`);
    expect(row?.name).toBe(`${TAG} EVENT`);
  });
});
