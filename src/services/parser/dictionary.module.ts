declare const require: any;
declare const process: any;
const fs = require('fs');
const path = require('path');
import { ParserModule, ParsedMetadata } from './parser.types';

/**
 * Simple Levenshtein distance implementation for fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create a matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first column and row
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill the matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1, // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity ratio between two strings (0-1)
 */
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
  aliases: Record<string, string>;
  cameraTypes: Record<string, string>;
}

/**
 * Dictionary-based parser module for correcting and normalizing metadata
 */
export class DictionaryModule implements ParserModule {
  private dictionary: KpopDictionary | null = null;
  private readonly dictionaryPath: string;

  constructor(dictionaryPath?: string) {
    this.dictionaryPath = dictionaryPath || path.join(process.cwd(), 'data', 'kpop_dict.json');
  }

  /**
   * Load the dictionary from file
   */
  private loadDictionary(): KpopDictionary {
    if (this.dictionary) {
      return this.dictionary;
    }

    try {
      const content = fs.readFileSync(this.dictionaryPath, 'utf-8');
      this.dictionary = JSON.parse(content);
      return this.dictionary!;
    } catch (error) {
      console.warn(`Failed to load dictionary from ${this.dictionaryPath}:`, error);
      // Return empty dictionary as fallback
      this.dictionary = {
        groups: [],
        artists: {},
        songs: [],
        events: [],
        aliases: {},
        cameraTypes: {},
      };
      return this.dictionary;
    }
  }

  async parse(
    title: string,
    currentMeta: Partial<ParsedMetadata>,
  ): Promise<{ metadata: Partial<ParsedMetadata>; confidence: number }> {
    const dictionary = this.loadDictionary();
    const metadata: Partial<ParsedMetadata> = { ...currentMeta };
    let correctionsMade = 0;
    let fieldsChecked = 0;

    // Normalize and correct group_name
    fieldsChecked++;
    if (metadata.group_name) {
      const corrected = this.findBestMatch(
        metadata.group_name,
        dictionary.groups,
        dictionary.aliases,
      );
      if (corrected && corrected !== metadata.group_name) {
        metadata.group_name = corrected;
        correctionsMade++;
      } else if (corrected) {
        correctionsMade++; // No change needed but field is valid
      }
    } else {
      // Try to find group name in title using dictionary
      const foundGroup = this.findGroupInTitle(title, dictionary);
      if (foundGroup) {
        metadata.group_name = foundGroup;
        correctionsMade++;
      }
    }

    // Normalize and correct artist_name
    fieldsChecked++;
    if (metadata.artist_name) {
      // Check against all known artists
      const allArtists = Object.values(dictionary.artists).flat();
      const corrected = this.findBestMatch(metadata.artist_name, allArtists, dictionary.aliases);
      if (corrected && corrected !== metadata.artist_name) {
        metadata.artist_name = corrected;
        correctionsMade++;
      } else if (corrected) {
        correctionsMade++;
      }

      // Also check if artist belongs to a known group
      if (metadata.artist_name && !metadata.group_name) {
        for (const [group, artists] of Object.entries(dictionary.artists)) {
          if (artists.some((a) => a.toLowerCase() === metadata.artist_name?.toLowerCase())) {
            metadata.group_name = group;
            correctionsMade++;
            break;
          }
        }
      }
    } else {
      // Try to find artist name in title
      const foundArtist = this.findArtistInTitle(title, dictionary);
      if (foundArtist) {
        metadata.artist_name = foundArtist.name;
        if (foundArtist.group) {
          metadata.group_name = foundArtist.group;
        }
        correctionsMade++;
      }
    }

    // Normalize and correct song_title
    fieldsChecked++;
    if (metadata.song_title) {
      const corrected = this.findBestMatch(
        metadata.song_title,
        dictionary.songs,
        dictionary.aliases,
      );
      if (corrected && corrected !== metadata.song_title) {
        metadata.song_title = corrected;
        correctionsMade++;
      } else if (corrected) {
        correctionsMade++;
      }
    } else {
      // Try to find song title in title using dictionary
      const foundSong = this.findSongInTitle(title, dictionary);
      if (foundSong) {
        metadata.song_title = foundSong;
        correctionsMade++;
      }
    }

    // Normalize event
    fieldsChecked++;
    if (metadata.event) {
      const eventName = metadata.event.replace('@', '');
      const corrected = this.findBestMatch(eventName, dictionary.events, dictionary.aliases);
      if (corrected) {
        metadata.event = '@' + corrected;
        correctionsMade++;
      }
    }

    // Normalize camera_type
    fieldsChecked++;
    if (metadata.camera_type) {
      // Keep non-Latin custom tags as-is (e.g., Korean camera tags)
      if (/[^\x00-\x7F]/.test(metadata.camera_type)) {
        correctionsMade++;
      } else {
        const lowerCameraType = metadata.camera_type.toLowerCase();
        if (dictionary.cameraTypes[lowerCameraType]) {
          metadata.camera_type = dictionary.cameraTypes[lowerCameraType];
          correctionsMade++;
        } else {
          // Try to find partial match
          for (const [key, value] of Object.entries(dictionary.cameraTypes)) {
            if (lowerCameraType.includes(key) || key.includes(lowerCameraType)) {
              metadata.camera_type = value;
              correctionsMade++;
              break;
            }
          }
        }
      }
    }

    const confidence = fieldsChecked > 0 ? correctionsMade / fieldsChecked : 0;

    return { metadata, confidence };
  }

  public searchInTags(tags: string[], field: 'group' | 'artist' | 'song' | 'event'): string | null {
    const dictionary = this.loadDictionary();
    let candidates: string[] = [];

    if (field === 'group') {
      candidates = dictionary.groups;
    } else if (field === 'artist') {
      candidates = Object.values(dictionary.artists).flat();
    } else if (field === 'song') {
      candidates = dictionary.songs;
    } else {
      candidates = dictionary.events;
    }

    for (const tag of tags) {
      const normalizedTag = tag.trim();
      if (!normalizedTag) {
        continue;
      }

      const bestMatch = this.findBestMatch(normalizedTag, candidates, dictionary.aliases);
      if (bestMatch && similarity(normalizedTag.toLowerCase(), bestMatch.toLowerCase()) > 0.8) {
        return bestMatch;
      }
    }

    return null;
  }

  /**
   * Find best match for a string in a list of candidates using fuzzy matching
   */
  private findBestMatch(
    input: string,
    candidates: string[],
    aliases: Record<string, string>,
  ): string | null {
    const normalizedInput = input.trim().toLowerCase();

    // First check aliases
    if (aliases[normalizedInput]) {
      return aliases[normalizedInput];
    }

    // Check exact match (case-insensitive)
    const exactMatch = candidates.find((c) => c.toLowerCase() === normalizedInput);
    if (exactMatch) {
      return exactMatch;
    }

    // Check contains match
    const containsMatch = candidates.find((c) => {
      const candidate = c.toLowerCase();
      if (candidate.length < 3 || normalizedInput.length < 3) {
        return false;
      }
      return candidate.includes(normalizedInput) || normalizedInput.includes(candidate);
    });
    if (containsMatch) {
      return containsMatch;
    }

    // Fuzzy match with threshold
    let bestMatch: string | null = null;
    let bestScore = normalizedInput.length <= 4 ? 0.9 : 0.7; // Be stricter for short tokens

    for (const candidate of candidates) {
      const score = similarity(normalizedInput, candidate.toLowerCase());
      if (score > bestScore) {
        bestScore = score;
        bestMatch = candidate;
      }
    }

    return bestMatch;
  }

  /**
   * Find a group name in the title using dictionary
   */
  private findGroupInTitle(title: string, dictionary: KpopDictionary): string | null {
    const lowerTitle = title.toLowerCase();

    // Check aliases first
    for (const [alias, canonical] of Object.entries(dictionary.aliases)) {
      if (dictionary.groups.includes(canonical) && lowerTitle.includes(alias.toLowerCase())) {
        return canonical;
      }
    }

    // Check groups directly
    for (const group of dictionary.groups) {
      if (lowerTitle.includes(group.toLowerCase())) {
        return group;
      }
    }

    return null;
  }

  /**
   * Find an artist name in the title using dictionary
   */
  private findArtistInTitle(
    title: string,
    dictionary: KpopDictionary,
  ): { name: string; group?: string } | null {
    const lowerTitle = title.toLowerCase();

    for (const [group, artists] of Object.entries(dictionary.artists)) {
      for (const artist of artists) {
        const artistLower = artist.toLowerCase();
        const escapedArtist = artistLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (new RegExp(`(^|\\W)${escapedArtist}($|\\W)`, 'i').test(lowerTitle)) {
          return { name: artist, group };
        }
      }
    }

    // Check aliases
    for (const [alias, canonical] of Object.entries(dictionary.aliases)) {
      if (lowerTitle.includes(alias.toLowerCase())) {
        // Check if this alias maps to an artist
        for (const [group, artists] of Object.entries(dictionary.artists)) {
          if (artists.includes(canonical)) {
            return { name: canonical, group };
          }
        }
      }
    }

    return null;
  }

  /**
   * Find a song title in the title using dictionary
   */
  private findSongInTitle(title: string, dictionary: KpopDictionary): string | null {
    const lowerTitle = title.toLowerCase();

    // Check songs directly
    for (const song of dictionary.songs) {
      if (lowerTitle.includes(song.toLowerCase())) {
        return song;
      }
    }

    // Check aliases
    for (const [alias, canonical] of Object.entries(dictionary.aliases)) {
      if (dictionary.songs.includes(canonical) && lowerTitle.includes(alias.toLowerCase())) {
        return canonical;
      }
    }

    return null;
  }
}
