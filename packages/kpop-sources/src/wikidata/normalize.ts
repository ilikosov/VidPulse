import type { GroupPayload, GroupArtistPayload, GroupType, SongPayload } from '../types';
import { GROUP_TYPE_BY_QID, type SparqlBinding } from './queries';

function val(binding: SparqlBinding, key: string): string | undefined {
  const v = binding[key]?.value;
  return v && v.trim() ? v.trim() : undefined;
}

/** Wikidata entity URI → QID (last path segment). */
function qid(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  const m = uri.match(/Q\d+$/);
  return m ? m[0] : undefined;
}

/** A Korean label becomes an alias only when it differs from the chosen name. */
function aliasesFrom(name: string, ko: string | undefined): string[] {
  return ko && ko !== name ? [ko] : [];
}

/** Distinct candidate labels that differ from the chosen name, in order, deduped. */
function aliasesFromAll(name: string, candidates: (string | undefined)[]): string[] {
  const out: string[] = [];
  for (const c of candidates) {
    if (c && c !== name && !out.includes(c)) out.push(c);
  }
  return out;
}

interface GroupAccumulator {
  payload: GroupPayload;
  memberUris: Set<string>;
}

/**
 * Fold (group, song) SPARQL rows (from `buildSongsQuery`) into a map of group URI →
 * deduplicated SongPayload[]. Title = English label (fallback Korean); the Korean label
 * becomes an alias when it differs. Songs without any label are skipped.
 */
export function normalizeSongs(bindings: SparqlBinding[]): Map<string, SongPayload[]> {
  const byGroup = new Map<string, { songs: SongPayload[]; titles: Set<string> }>();

  for (const b of bindings) {
    const groupUri = val(b, 'group');
    if (!groupUri) continue;
    const songEn = val(b, 'songEn');
    const songKo = val(b, 'songKo');
    const title = songEn ?? songKo;
    if (!title) continue; // skip songs without a label

    let acc = byGroup.get(groupUri);
    if (!acc) {
      acc = { songs: [], titles: new Set() };
      byGroup.set(groupUri, acc);
    }
    const key = title.toLowerCase();
    if (acc.titles.has(key)) continue; // dedupe within the group
    acc.titles.add(key);
    acc.songs.push({ title, aliases: aliasesFromAll(title, [songKo]) });
  }

  return new Map([...byGroup].map(([uri, acc]) => [uri, acc.songs]));
}

/**
 * Fold (group, member) SPARQL rows into deduplicated GroupPayload[]:
 * - name = English label (fallback Korean, then QID),
 * - Korean label → alias,
 * - type from girl-group/boy-band classification (else 'mixed'),
 * - active = false when a dissolution date (P576) is present,
 * - members = distinct humans with a usable label, each a 'group' membership.
 */
export function normalizeGroups(
  bindings: SparqlBinding[],
  songsByGroupUri?: Map<string, SongPayload[]>,
): GroupPayload[] {
  const byGroup = new Map<string, GroupAccumulator>();

  for (const b of bindings) {
    const groupUri = val(b, 'group');
    if (!groupUri) continue;

    let acc = byGroup.get(groupUri);
    if (!acc) {
      const groupEn = val(b, 'groupEn');
      const groupKo = val(b, 'groupKo');
      const name = groupEn ?? groupKo ?? qid(groupUri);
      if (!name) continue; // unusable group
      const typeQid = qid(val(b, 'typeClass'));
      const type: GroupType = (typeQid && GROUP_TYPE_BY_QID[typeQid]) || 'mixed';
      acc = {
        payload: {
          name,
          type,
          active: !val(b, 'dissolved'),
          aliases: aliasesFrom(name, groupKo),
          artists: [],
        },
        memberUris: new Set(),
      };
      byGroup.set(groupUri, acc);
    } else if (val(b, 'dissolved')) {
      // A later row may carry the dissolution date the first row lacked.
      acc.payload.active = false;
    }

    const memberUri = val(b, 'member');
    if (!memberUri || acc.memberUris.has(memberUri)) continue;
    const memberEn = val(b, 'memberEn');
    const memberKo = val(b, 'memberKo');
    // Prefer the stage name (P742) — that's what video titles use (e.g. "Yeji"), not the
    // legal label ("Hwang Ye-ji"). The legal/Korean labels become aliases so full-name
    // mentions still resolve. Fall back to labels when no stage name exists.
    const memberStageEn = val(b, 'memberStageEn');
    const memberStageKo = val(b, 'memberStageKo');
    const memberName = memberStageEn ?? memberStageKo ?? memberEn ?? memberKo;
    if (!memberName) continue; // skip members without any label
    acc.memberUris.add(memberUri);
    const artist: GroupArtistPayload = {
      name: memberName,
      aliases: aliasesFromAll(memberName, [memberStageKo, memberEn, memberKo]),
      membership: { activityType: 'group', status: 'active', isPrimary: true },
    };
    acc.payload.artists!.push(artist);
  }

  // Drop empty alias arrays for a tidy payload; attach Wikidata songs by group URI.
  return [...byGroup.entries()].map(([uri, { payload }]) => {
    if (payload.aliases && payload.aliases.length === 0) delete payload.aliases;
    payload.artists = payload.artists?.map((a) => {
      if (a.aliases && a.aliases.length === 0) delete a.aliases;
      return a;
    });
    const songs = songsByGroupUri?.get(uri);
    if (songs && songs.length) payload.songs = songs;
    return payload;
  });
}
