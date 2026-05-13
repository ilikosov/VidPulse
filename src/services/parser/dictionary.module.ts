import { dictionaryService } from '../dictionary.service';
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
  events: string[];
  aliases: {
    group: Record<string, string>;
    artist: Record<string, string>;
    song: Record<string, string>;
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

    return normalizedHaystack.includes(normalizedNeedle);
  }

  private async loadDictionary(): Promise<KpopDictionary> {
    if (this.dictionary) return this.dictionary;

    const [groups, artists, songs, events, aliases] = await Promise.all([
      dictionaryService.getAllGroups(),
      dictionaryService.getAllArtists(),
      dictionaryService.getAllSongs(),
      dictionaryService.getAllEvents(),
      dictionaryService.getAllAliases(),
    ]);

    const artistMap: Record<string, string[]> = {};
    for (const a of artists) {
      const groupName = (a as any).group_name || 'SOLO';
      if (!artistMap[groupName]) artistMap[groupName] = [];
      artistMap[groupName].push(a.name);
    }

    const aliasMap: KpopDictionary['aliases'] = { group: {}, artist: {}, song: {} };
    for (const alias of aliases as any[]) {
      const normalized = this.normalizeLookup(String(alias.alias));
      if (!normalized) {
        continue;
      }
      const resolved = await dictionaryService.resolveAlias(alias.entity_type, alias.alias);
      if (!resolved?.name) {
        continue;
      }

      if (alias.entity_type === 'group') {
        aliasMap.group[normalized] = resolved.name;
      } else if (alias.entity_type === 'artist') {
        aliasMap.artist[normalized] = resolved.name;
      } else if (alias.entity_type === 'song') {
        aliasMap.song[normalized] = resolved.name;
      }
    }

    this.dictionary = {
      groups: groups.map((g: any) => String(g.name)),
      artists: artistMap,
      songs: songs.map((s) => s.title),
      events: events.map((e) => e.name),
      aliases: aliasMap,
      cameraTypes: this.cameraTypeMap,
    };

    return this.dictionary;
  }

  async parse(
    title: string,
    currentMeta: Partial<ParsedMetadata>,
  ): Promise<{ metadata: Partial<ParsedMetadata>; confidence: number }> {
    const dictionary = await this.loadDictionary();
    const metadata: Partial<ParsedMetadata> = { ...currentMeta };
    let correctionsMade = 0;
    let fieldsChecked = 0;

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
      const corrected = this.findBestMatch(
        metadata.artist_name,
        allArtists,
        dictionary.aliases.artist,
      );
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
      const corrected = this.findBestMatch(
        metadata.song_title,
        dictionary.songs,
        dictionary.aliases.song,
      );
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
      const corrected = this.findBestMatch(eventName, dictionary.events, {});
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

    for (const candidate of candidates) {
      const score = similarity(normalizedInput, this.normalizeLookup(candidate));
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
    for (const [alias, canonical] of Object.entries(dictionary.aliases.artist)) {
      if (this.containsTerm(title, alias)) {
        for (const [group, artists] of Object.entries(dictionary.artists)) {
          if (
            artists.some(
              (artist) => this.normalizeLookup(artist) === this.normalizeLookup(canonical),
            )
          ) {
            return { name: canonical, group };
          }
        }
        return { name: canonical };
      }
    }

    for (const [group, artists] of Object.entries(dictionary.artists)) {
      for (const artist of artists) {
        if (this.containsTerm(title, artist)) {
          return { name: artist, group };
        }
      }
    }

    return null;
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
