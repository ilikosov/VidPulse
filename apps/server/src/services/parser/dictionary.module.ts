import { knex } from '@vidpulse/db';
import {
  groupService,
  artistService,
  songService,
  eventService,
  aliasService,
} from '../dictionary';
import { ParsedMetadata, ParserModule } from './parser.types';

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + 1);
      }
    }
  }

  return dp[m][n];
}

function similarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

interface KpopDictionary {
  groups: string[];
  artists: Record<string, string[]>;
  songs: string[];
  /** group name → its song titles (from dictionary_song_groups, via getAllSongs.group_name). */
  songsByGroup: Record<string, string[]>;
  events: string[];
  aliases: {
    group: Record<string, string>;
    artist: Record<string, string>;
    song: Record<string, string>;
    event: Record<string, string>;
  };
  cameraTypes: Record<string, string>;
}

export class DictionaryModule implements ParserModule {
  private dictionary: KpopDictionary | null = null;

  private readonly cameraTypeMap: Record<string, string> = {
    직캠: 'FANCAM',
    fancam: 'FANCAM',
    'fan cam': 'FANCAM',
    페이스캠: 'FACECAM',
    facecam: 'FACECAM',
    'face cam': 'FACECAM',
    얼빡직캠: 'CLOSE-UP FANCAM',
    세로: 'VERTICAL',
    가로: 'HORIZONTAL',
    풀캠: 'FULL CAM',
    fullcam: 'FULL CAM',
    'full cam': 'FULL CAM',
    choreography: 'CHOREOGRAPHY',
    '4k': '4K',
    '8k': '8K',
  };

  private readonly eventAliasMap: Record<string, string> = {
    inkigayo: 'INKIGAYO',
    'sbs inkigayo': 'SBS INKIGAYO',
    musicbank: 'MUSIC BANK',
    'music bank': 'MUSIC BANK',
    뮤직뱅크: 'MUSIC BANK',
    musiccore: 'MUSIC CORE',
    'music core': 'MUSIC CORE',
    음악중심: 'MUSIC CORE',
    mcountdown: 'M COUNTDOWN',
    연세대: 'YONSEI UNIVERSITY',
    고려대: 'KOREA UNIVERSITY',
    경일대: 'KYUNGIL UNIVERSITY',
    '경일대 축제': 'KYUNGIL UNIVERSITY FESTIVAL',
    경일대학교: 'KYUNGIL UNIVERSITY',
    '경일대학교 축제': 'KYUNGIL UNIVERSITY FESTIVAL',
  };

  private normalizeLookup(value: string): string {
    return value
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeLatinCanonical(value: string): string {
    const compacted = value.trim().replace(/\s+/g, ' ');
    return /^[A-Za-z0-9_&'.\-\s]+$/.test(compacted) ? compacted.toUpperCase() : compacted;
  }

  private containsTerm(haystack: string, needle: string): boolean {
    const normalizedHaystack = this.normalizeLookup(haystack);
    const normalizedNeedle = this.normalizeLookup(needle);
    if (!normalizedNeedle) {
      return false;
    }

    if (/^[a-z0-9\s&'.-]+$/i.test(normalizedNeedle)) {
      const escaped = normalizedNeedle
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\s+/g, '\\s+');
      const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
      return regex.test(normalizedHaystack);
    }

    // A Hangul needle must not match inside a longer Hangul run: '이브' (Yves) is a
    // substring of '아이브' (IVE) but not a mention of that artist.
    const escaped = normalizedNeedle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^가-힣])${escaped}([^가-힣]|$)`).test(normalizedHaystack);
  }

  private async loadDictionary(): Promise<KpopDictionary> {
    if (this.dictionary) return this.dictionary;

    const [groups, artists, songs, events, aliases] = await Promise.all([
      groupService.getAllGroups(),
      artistService.getAllArtists(),
      songService.getAllSongs(),
      eventService.getAllEvents(),
      aliasService.getAllAliases(),
    ]);

    const artistMap: Record<string, string[]> = {};
    for (const a of artists) {
      const groupName = String(a.group_name || 'SOLO');
      if (!artistMap[groupName]) artistMap[groupName] = [];
      artistMap[groupName].push(String(a.name));
    }

    // group name → its song titles. getAllSongs() already carries the linked group
    // (MIN over dictionary_song_groups), so no extra query is needed.
    const songsByGroup: Record<string, string[]> = {};
    for (const s of songs as any[]) {
      if (!s.group_name) continue;
      const groupName = String(s.group_name);
      if (!songsByGroup[groupName]) songsByGroup[groupName] = [];
      songsByGroup[groupName].push(String(s.title));
    }

    const aliasMap: KpopDictionary['aliases'] = { group: {}, artist: {}, song: {}, event: {} };
    for (const alias of aliases) {
      const normalized = this.normalizeLookup(String(alias.alias));
      if (!normalized) {
        continue;
      }
      const resolved = await aliasService.resolveAlias(alias.entity_type, alias.alias);
      if (!resolved?.name) {
        continue;
      }

      if (alias.entity_type === 'group') {
        aliasMap.group[normalized] = resolved.name;
      } else if (alias.entity_type === 'artist') {
        aliasMap.artist[normalized] = resolved.name;
      } else if (alias.entity_type === 'song') {
        aliasMap.song[normalized] = resolved.name;
      } else if (alias.entity_type === 'event') {
        aliasMap.event[normalized] = resolved.name;
      }
    }

    const dictionary: KpopDictionary = {
      groups: groups.map((g: any) => String(g.name)),
      artists: artistMap,
      songs: songs.map((s: any) => String(s.title)),
      songsByGroup,
      events: events.map((e: any) => String(e.name)),
      aliases: aliasMap,
      cameraTypes: this.cameraTypeMap,
    };

    this.dictionary = dictionary;
    return dictionary;
  }

  async parse(
    title: string,
    currentMeta: Partial<ParsedMetadata>,
  ): Promise<{ metadata: Partial<ParsedMetadata>; confidence: number }> {
    const dictionary = await this.loadDictionary();
    const metadata: Partial<ParsedMetadata> = { ...currentMeta };
    let correctionsMade = 0;
    let fieldsChecked = 0;

    // A fancam credit like "(I.O.I SE JEONG FanCam)" is split by word position, so a
    // multi-word artist lands wrong: group="I.O.I SE", artist="JEONG". Re-split against
    // known groups before correcting the fields separately — otherwise findBestMatch can
    // fix the group but the stray word ("SE") is lost from the artist for good.
    if (metadata.group_name && metadata.artist_name && metadata.group_name !== 'SOLO') {
      const resplit = this.resplitGroupArtist(
        metadata.group_name,
        metadata.artist_name,
        dictionary,
      );
      if (resplit) {
        metadata.group_name = resplit.group;
        metadata.artist_name = resplit.artist;
      }
    }

    fieldsChecked++;
    if (metadata.group_name) {
      const corrected = this.findBestMatch(
        metadata.group_name,
        dictionary.groups,
        dictionary.aliases.group,
      );
      if (corrected) {
        if (corrected !== metadata.group_name) {
          metadata.group_name = corrected;
        }
        correctionsMade++;
      } else {
        metadata.group_name = this.normalizeLatinCanonical(metadata.group_name);
      }
    } else {
      const foundGroup = this.findGroupInTitle(title, dictionary);
      if (foundGroup) {
        metadata.group_name = foundGroup;
        correctionsMade++;
      }
    }

    fieldsChecked++;
    if (metadata.artist_name) {
      const allArtists = Object.values(dictionary.artists).flat();
      // When a group is known, resolve the artist among that group's members first — this
      // keeps a member from snapping onto a similarly-spelled artist in another group.
      const scopedArtists =
        metadata.group_name && metadata.group_name !== 'SOLO'
          ? (dictionary.artists[metadata.group_name] ?? [])
          : [];
      let corrected: string | null = null;
      if (scopedArtists.length) {
        corrected = this.findBestMatch(
          metadata.artist_name,
          scopedArtists,
          this.filterAliases(dictionary.aliases.artist, scopedArtists),
        );
      }
      if (!corrected) {
        corrected = this.findBestMatch(metadata.artist_name, allArtists, dictionary.aliases.artist);
      }
      if (corrected) {
        if (corrected !== metadata.artist_name) {
          metadata.artist_name = corrected;
        }
        correctionsMade++;
      } else {
        metadata.artist_name = this.normalizeLatinCanonical(metadata.artist_name);
      }
      if (metadata.artist_name && !metadata.group_name) {
        for (const [group, artistsOfGroup] of Object.entries(dictionary.artists)) {
          if (
            artistsOfGroup.some(
              (a) => this.normalizeLookup(a) === this.normalizeLookup(metadata.artist_name!),
            )
          ) {
            metadata.group_name = group;
            correctionsMade++;
            break;
          }
        }
      }
    } else {
      const foundArtist = this.findArtistInTitle(title, dictionary);
      if (foundArtist) {
        metadata.artist_name = foundArtist.name;
        if (!metadata.group_name && foundArtist.group) {
          metadata.group_name = foundArtist.group;
        }
        correctionsMade++;
      }
    }

    fieldsChecked++;
    if (metadata.song_title) {
      // Prefer a song of the identified group before falling back to the full catalogue.
      const scopedSongs =
        metadata.group_name && metadata.group_name !== 'SOLO'
          ? (dictionary.songsByGroup[metadata.group_name] ?? [])
          : [];
      let corrected: string | null = null;
      if (scopedSongs.length) {
        corrected = this.findBestMatch(
          metadata.song_title,
          scopedSongs,
          this.filterAliases(dictionary.aliases.song, scopedSongs),
        );
      }
      if (!corrected) {
        corrected = this.findBestMatch(
          metadata.song_title,
          dictionary.songs,
          dictionary.aliases.song,
        );
      }
      if (corrected) {
        if (corrected !== metadata.song_title) {
          metadata.song_title = corrected;
        }
        correctionsMade++;
      }
    } else {
      const foundSong = this.findSongInTitle(title, dictionary);
      if (foundSong) {
        metadata.song_title = foundSong;
        correctionsMade++;
      }
    }

    fieldsChecked++;
    if (metadata.event) {
      const eventName = metadata.event.replace('@', '');
      const aliasEvent = this.eventAliasMap[this.normalizeLookup(eventName)];
      const corrected = this.findBestMatch(eventName, dictionary.events, dictionary.aliases.event);
      const canonicalEvent = aliasEvent || corrected;
      if (canonicalEvent) {
        metadata.event = '@' + canonicalEvent;
        correctionsMade++;
      }
    }

    fieldsChecked++;
    if (metadata.camera_type) {
      const normalizedCamera = this.normalizeCameraType(metadata.camera_type);
      if (normalizedCamera) {
        metadata.camera_type = normalizedCamera;
      }
      correctionsMade++;
    }

    const confidence = fieldsChecked > 0 ? correctionsMade / fieldsChecked : 0;
    return { metadata, confidence };
  }

  // Longest word-prefix of "<group words> <artist words>" that exactly matches a known
  // group (name or alias) wins; the remaining words are the artist. Returns null when no
  // prefix resolves — unknown groups keep the original positional split.
  private resplitGroupArtist(
    group: string,
    artist: string,
    dictionary: KpopDictionary,
  ): { group: string; artist: string } | null {
    const words = `${group} ${artist}`.split(/\s+/).filter(Boolean);
    for (let k = words.length - 1; k >= 1; k--) {
      const candidate = words.slice(0, k).join(' ');
      const normalized = this.normalizeLookup(candidate);
      const resolved =
        dictionary.aliases.group[normalized] ??
        dictionary.groups.find((g) => this.normalizeLookup(g) === normalized);
      if (resolved) {
        return { group: resolved, artist: words.slice(k).join(' ') };
      }
    }
    return null;
  }

  /**
   * Resolve a name to a known group (exact name/alias match only) when it is NOT a known
   * artist. Detects group-stage credits ("(I.O.I FanCam)") that the regex SOLO heuristic
   * mislabels as a solo artist. Fuzzy matching is deliberately avoided: a real solo artist
   * whose name merely resembles a group must stay a solo stage.
   */
  public async resolveGroupOnlyCredit(name: string): Promise<string | null> {
    const dictionary = await this.loadDictionary();
    const normalized = this.normalizeLookup(name);

    const isKnownArtist =
      Boolean(dictionary.aliases.artist[normalized]) ||
      Object.values(dictionary.artists)
        .flat()
        .some((artist) => this.normalizeLookup(artist) === normalized);
    if (isKnownArtist) {
      return null;
    }

    return (
      dictionary.aliases.group[normalized] ??
      dictionary.groups.find((group) => this.normalizeLookup(group) === normalized) ??
      null
    );
  }

  private normalizeCameraType(cameraType: string): string | undefined {
    const normalized = this.normalizeLookup(cameraType);
    if (this.cameraTypeMap[normalized]) {
      return this.cameraTypeMap[normalized];
    }

    for (const [alias, canonical] of Object.entries(this.cameraTypeMap)) {
      if (normalized.includes(alias)) {
        return canonical;
      }
    }

    return undefined;
  }

  public async searchInTags(
    tags: string[],
    field: 'group' | 'artist' | 'song' | 'event',
  ): Promise<string | null> {
    const dictionary = await this.loadDictionary();

    let candidates: string[] = [];
    let aliases: Record<string, string> = {};

    if (field === 'group') {
      candidates = dictionary.groups;
      aliases = dictionary.aliases.group;
    } else if (field === 'artist') {
      candidates = Object.values(dictionary.artists).flat();
      aliases = dictionary.aliases.artist;
    } else if (field === 'song') {
      candidates = dictionary.songs;
      aliases = dictionary.aliases.song;
    } else {
      candidates = dictionary.events;
    }

    for (const tag of tags) {
      const bestMatch = this.findBestMatch(tag, candidates, aliases);
      if (
        bestMatch &&
        similarity(this.normalizeLookup(tag), this.normalizeLookup(bestMatch)) > 0.8
      ) {
        return bestMatch;
      }
    }

    return null;
  }

  /**
   * Scan free text (e.g. a video description) for a known group/artist/song mention.
   * Unlike searchInTags (per-tag fuzzy match), this reuses the title-scanning helpers,
   * which look for whole dictionary names/aliases inside longer text.
   */
  public async searchInText(text: string, field: 'group' | 'song'): Promise<string | null>;
  public async searchInText(
    text: string,
    field: 'artist',
  ): Promise<{ name: string; group?: string } | null>;
  public async searchInText(
    text: string,
    field: 'group' | 'artist' | 'song',
  ): Promise<string | { name: string; group?: string } | null> {
    const dictionary = await this.loadDictionary();
    if (field === 'group') {
      return this.findGroupInTitle(text, dictionary);
    }
    if (field === 'artist') {
      return this.findArtistInTitle(text, dictionary);
    }
    return this.findSongInTitle(text, dictionary);
  }

  public async isOwnGroupSong(
    groupName?: string,
    songTitle?: string,
  ): Promise<boolean | undefined> {
    if (!groupName?.trim() || !songTitle?.trim()) {
      return undefined;
    }

    const group = await this.resolveGroupByNameOrAlias(groupName);
    const song = await this.resolveSongByTitleOrAlias(songTitle);

    if (!group || !song) {
      return undefined;
    }

    const link = await knex('dictionary_song_groups')
      .where({ group_id: group.id, song_id: song.id })
      .first();

    return Boolean(link);
  }

  public async isOwnArtistSong(
    artistName?: string,
    songTitle?: string,
  ): Promise<boolean | undefined> {
    if (!artistName?.trim() || !songTitle?.trim()) {
      return undefined;
    }

    const artist = await this.resolveArtistByNameOrAlias(artistName);
    const song = await this.resolveSongByTitleOrAlias(songTitle);

    if (!artist || !song) {
      return undefined;
    }

    const link = await knex('dictionary_song_artists')
      .where({ artist_id: artist.id, song_id: song.id })
      .first();

    return Boolean(link);
  }

  private async resolveArtistByNameOrAlias(
    name: string,
  ): Promise<{ id: number; name: string } | null> {
    const normalized = this.normalizeLookup(name);

    const artist = await knex('dictionary_artists')
      .whereRaw('LOWER(name) = ?', [normalized])
      .first('id', 'name');

    if (artist) {
      return artist as { id: number; name: string };
    }

    const alias = await knex('dictionary_aliases')
      .where({ entity_type: 'artist' })
      .andWhereRaw('LOWER(alias) = ?', [normalized])
      .first('entity_id');

    if (!alias) {
      return null;
    }

    const artistByAlias = await knex('dictionary_artists')
      .where({ id: alias.entity_id })
      .first('id', 'name');

    return (artistByAlias as { id: number; name: string }) ?? null;
  }

  private async resolveGroupByNameOrAlias(
    name: string,
  ): Promise<{ id: number; name: string } | null> {
    const normalized = this.normalizeLookup(name);

    const group = await knex('dictionary_groups')
      .whereRaw('LOWER(name) = ?', [normalized])
      .first('id', 'name');

    if (group) {
      return group as { id: number; name: string };
    }

    const alias = await knex('dictionary_aliases')
      .where({ entity_type: 'group' })
      .andWhereRaw('LOWER(alias) = ?', [normalized])
      .first('entity_id');

    if (!alias) {
      return null;
    }

    const groupByAlias = await knex('dictionary_groups')
      .where({ id: alias.entity_id })
      .first('id', 'name');

    return (groupByAlias as { id: number; name: string }) ?? null;
  }

  private async resolveSongByTitleOrAlias(
    title: string,
  ): Promise<{ id: number; title: string } | null> {
    const normalized = this.normalizeLookup(title);

    const song = await knex('dictionary_songs')
      .whereRaw('LOWER(title) = ?', [normalized])
      .first('id', 'title');

    if (song) {
      return song as { id: number; title: string };
    }

    const alias = await knex('dictionary_aliases')
      .where({ entity_type: 'song' })
      .andWhereRaw('LOWER(alias) = ?', [normalized])
      .first('entity_id');

    if (!alias) {
      return null;
    }

    const songByAlias = await knex('dictionary_songs')
      .where({ id: alias.entity_id })
      .first('id', 'title');

    return (songByAlias as { id: number; title: string }) ?? null;
  }

  /** Restrict an alias→canonical map to aliases whose canonical is in `allowed`. */
  private filterAliases(
    aliasMap: Record<string, string>,
    allowed: string[],
  ): Record<string, string> {
    const set = new Set(allowed.map((a) => this.normalizeLookup(a)));
    return Object.fromEntries(
      Object.entries(aliasMap).filter(([, canonical]) => set.has(this.normalizeLookup(canonical))),
    );
  }

  private findBestMatch(
    input: string,
    candidates: string[],
    aliases: Record<string, string>,
  ): string | null {
    const normalizedInput = this.normalizeLookup(input);

    if (aliases[normalizedInput]) {
      return aliases[normalizedInput];
    }

    const exactCandidate = candidates.find((c) => this.normalizeLookup(c) === normalizedInput);
    if (exactCandidate) {
      return exactCandidate;
    }

    for (const [alias, canonical] of Object.entries(aliases)) {
      if (this.containsTerm(input, alias)) {
        return canonical;
      }
    }

    const containsCandidate = candidates.find((candidate) => this.containsTerm(input, candidate));
    if (containsCandidate) {
      return containsCandidate;
    }

    let bestMatch: string | null = null;
    let bestScore = normalizedInput.length <= 4 ? 0.9 : 0.7;

    // A differing leading character signals a genuinely different name, not a typo or
    // romanization variant (which keep their first letter). Without this guard a new
    // member absent from the dictionary snaps onto a similar existing artist — e.g.
    // "GAWON" (MEOVV) → "Dawon" (similarity 0.8 > 0.7).
    const inputFirst = normalizedInput[0];

    for (const candidate of candidates) {
      const normalizedCandidate = this.normalizeLookup(candidate);
      if (normalizedCandidate[0] !== inputFirst) continue;
      const score = similarity(normalizedInput, normalizedCandidate);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    return bestMatch;
  }

  private findGroupInTitle(title: string, dictionary: KpopDictionary): string | null {
    for (const [alias, canonical] of Object.entries(dictionary.aliases.group)) {
      if (this.containsTerm(title, alias)) {
        return canonical;
      }
    }

    for (const group of dictionary.groups) {
      if (this.containsTerm(title, group)) {
        return group;
      }
    }

    return null;
  }

  private findArtistInTitle(
    title: string,
    dictionary: KpopDictionary,
  ): { name: string; group?: string } | null {
    // Pick the artist whose name/alias appears earliest in the title (ties broken by the
    // longer match) instead of the first one in dictionary iteration order. Otherwise a song
    // word that happens to contain an artist alias as a substring (e.g. the alias "수영"
    // inside the song "수영해") could outrank the real performer purely because of DB order.
    const haystack = this.normalizeLookup(title);
    const matches: Array<{ name: string; group?: string; pos: number; len: number }> = [];

    const consider = (needle: string, name: string, group?: string) => {
      if (!this.containsTerm(title, needle)) {
        return;
      }
      const normalizedNeedle = this.normalizeLookup(needle);
      const pos = haystack.indexOf(normalizedNeedle);
      if (pos < 0) {
        return;
      }
      matches.push({ name, group, pos, len: normalizedNeedle.length });
    };

    for (const [alias, canonical] of Object.entries(dictionary.aliases.artist)) {
      let group: string | undefined;
      for (const [g, artists] of Object.entries(dictionary.artists)) {
        if (
          artists.some((artist) => this.normalizeLookup(artist) === this.normalizeLookup(canonical))
        ) {
          group = g;
          break;
        }
      }
      consider(alias, canonical, group);
    }

    for (const [group, artists] of Object.entries(dictionary.artists)) {
      for (const artist of artists) {
        consider(artist, artist, group);
      }
    }

    if (matches.length === 0) {
      return null;
    }

    // Earliest occurrence wins; ties broken by the longer (more specific) match.
    matches.sort((a, b) => a.pos - b.pos || b.len - a.len);
    return { name: matches[0].name, group: matches[0].group };
  }

  private findSongInTitle(title: string, dictionary: KpopDictionary): string | null {
    for (const [alias, canonical] of Object.entries(dictionary.aliases.song)) {
      if (this.containsTerm(title, alias)) {
        return canonical;
      }
    }

    for (const song of dictionary.songs) {
      if (this.containsTerm(title, song)) {
        return song;
      }
    }

    return null;
  }
}
