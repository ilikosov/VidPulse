import { ParsedMetadata, ParserModule } from './parser.types';
import { RegexModule, SOLO_GROUP } from './regex.module';
import { DictionaryModule } from './dictionary.module';
import { logger } from '../../lib/logger';
import { splitSongTitles } from './songTitles.util';

const MIN_CONFIDENCE_THRESHOLD = 0.5;

function hasUnresolvedCoreAliases(metadata: Partial<ParsedMetadata>): boolean {
  const identityValues = [metadata.group_name, metadata.artist_name].filter((v): v is string =>
    Boolean(v),
  );
  return identityValues.some((value) => /[가-힣]/.test(value));
}

function calculateMetadataConfidence(metadata: Partial<ParsedMetadata>): number {
  let score = 0;

  if (metadata.group_name || metadata.artist_name) score += 0.2;
  if (metadata.song_title) score += 0.22;
  if (metadata.perf_date) score += 0.16;
  if (metadata.event) score += 0.12;
  if (metadata.camera_type) score += 0.08;
  if (metadata.is_fancam !== undefined) score += 0.12;
  if ((metadata.fancam_confidence ?? 0) >= 0.8) score += 0.1;
  if (metadata.is_own_group_song !== undefined) score += 0.02;
  if (metadata.is_own_artist_song !== undefined) score += 0.02;

  return Number(Math.min(1, score).toFixed(2));
}

function hasRequiredFields(
  metadata: Partial<ParsedMetadata>,
  title?: string,
  publishedAt?: string,
): boolean {
  const normalizedTitle = title?.toLowerCase() ?? '';
  if (normalizedTitle.includes('private video')) {
    return false;
  }

  const hasIdentity = Boolean(metadata.group_name || metadata.artist_name);
  const hasClassifier = Boolean(metadata.group_name || metadata.song_title || metadata.event);

  if (metadata.is_fancam === true) {
    const hasPerformanceContext = Boolean(metadata.song_title || metadata.event);
    if (!hasIdentity || !hasPerformanceContext) {
      return false;
    }
  }

  if (metadata.is_fancam === false && !hasClassifier) {
    return false;
  }

  if (!metadata.perf_date && !publishedAt && metadata.is_fancam === true) {
    return false;
  }

  return true;
}

export class ParserService {
  constructor(
    private modules: ParserModule[],
    private dictionaryModule?: DictionaryModule,
  ) {}

  async parseTitle(title: string, publishedAt?: string, tags?: string[]) {
    const normalizedTitle = title.trim().toLowerCase();
    if (normalizedTitle === 'private video') {
      return {
        metadata: {
          is_fancam: false,
          fancam_confidence: 1,
          confidence: 0,
        },
        needsReview: true,
      };
    }

    let currentMetadata: Partial<ParsedMetadata> = {};

    for (const module of this.modules) {
      try {
        const result = await module.parse(title, currentMetadata);
        for (const key of Object.keys(result.metadata) as Array<keyof ParsedMetadata>) {
          if (key === 'confidence') continue;
          const value = result.metadata[key];
          if (value !== undefined && value !== null && value !== '') {
            (currentMetadata as any)[key] = value;
          }
        }
      } catch (error) {
        logger.warn('Parser module failed:', error);
      }
    }

    // "(I.O.I FanCam)" credits the whole group: the regex heuristic can only guess SOLO for
    // a single-name credit, so flip it back to a group stage when the "artist" is a known group.
    if (
      currentMetadata.group_name === SOLO_GROUP &&
      currentMetadata.artist_name &&
      this.dictionaryModule
    ) {
      const group = await this.dictionaryModule.resolveGroupOnlyCredit(currentMetadata.artist_name);
      if (group) {
        currentMetadata.group_name = group;
        delete currentMetadata.artist_name;
      }
    }

    if (tags?.length && this.dictionaryModule) {
      if (!currentMetadata.group_name && !currentMetadata.artist_name) {
        currentMetadata.group_name =
          (await this.dictionaryModule.searchInTags(tags, 'group')) || currentMetadata.group_name;
        currentMetadata.artist_name =
          (await this.dictionaryModule.searchInTags(tags, 'artist')) || currentMetadata.artist_name;
      }
      currentMetadata.song_title =
        currentMetadata.song_title ||
        (await this.dictionaryModule.searchInTags(tags, 'song')) ||
        currentMetadata.song_title;
      currentMetadata.event =
        currentMetadata.event ||
        (await this.dictionaryModule.searchInTags(tags, 'event')) ||
        currentMetadata.event;
    }

    const parsedSongTitles = splitSongTitles(
      currentMetadata.song_title,
      currentMetadata.song_titles,
    );
    if (parsedSongTitles.length > 0) {
      currentMetadata.song_titles = parsedSongTitles;
      currentMetadata.song_title = parsedSongTitles[parsedSongTitles.length - 1];
    }

    if (this.dictionaryModule) {
      const songsForOwnership = currentMetadata.song_titles?.length
        ? currentMetadata.song_titles
        : currentMetadata.song_title
          ? [currentMetadata.song_title]
          : [];

      const ownGroupResults = await Promise.all(
        songsForOwnership.map((songTitle) =>
          this.dictionaryModule!.isOwnGroupSong?.(currentMetadata.group_name, songTitle),
        ),
      );
      const isOwnGroupSong = ownGroupResults.some((value) => value === true)
        ? true
        : ownGroupResults.every((value) => value === false)
          ? false
          : undefined;

      if (isOwnGroupSong !== undefined) {
        currentMetadata.is_own_group_song = isOwnGroupSong;
      }

      const ownArtistResults = await Promise.all(
        songsForOwnership.map((songTitle) =>
          this.dictionaryModule!.isOwnArtistSong(currentMetadata.artist_name, songTitle),
        ),
      );
      const isOwnArtistSong = ownArtistResults.some((value) => value === true)
        ? true
        : ownArtistResults.every((value) => value === false)
          ? false
          : undefined;

      if (isOwnArtistSong !== undefined) {
        currentMetadata.is_own_artist_song = isOwnArtistSong;
      }
    }

    const confidence = calculateMetadataConfidence(currentMetadata);
    currentMetadata.confidence = confidence;

    return {
      metadata: currentMetadata,
      needsReview:
        !hasRequiredFields(currentMetadata, title, publishedAt) ||
        confidence < MIN_CONFIDENCE_THRESHOLD ||
        hasUnresolvedCoreAliases(currentMetadata),
    };
  }
}

const defaultDictionaryModule = new DictionaryModule();
const defaultParserService = new ParserService(
  [new RegexModule(), defaultDictionaryModule],
  defaultDictionaryModule,
);

export async function parseTitle(title: string, publishedAt?: string, tags?: string[]) {
  return defaultParserService.parseTitle(title, publishedAt, tags);
}

export function validateField(
  field: keyof ParsedMetadata,
  value: string | undefined,
): { valid: boolean; normalizedValue?: string } {
  if (!value) return { valid: false };
  switch (field) {
    case 'perf_date':
      return {
        valid: /^(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(value),
        normalizedValue: value,
      };
    case 'event':
      return {
        valid: true,
        normalizedValue: (value.startsWith('@') ? value : '@' + value).toUpperCase(),
      };
    case 'group_name':
    case 'artist_name':
    case 'song_title':
    case 'camera_type':
      return { valid: true, normalizedValue: value.trim() };
    default:
      return { valid: true, normalizedValue: value };
  }
}

export { calculateMetadataConfidence };
