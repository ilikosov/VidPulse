import { ParsedMetadata, ParserModule } from './parser.types';
import type { ParserTraceStep } from '@vidpulse/shared';
import type { IParser } from '../../interfaces/services';
import { RegexModule, SOLO_GROUP } from './regex.module';
import { DictionaryModule } from './dictionary.module';
import { logger } from '../../lib/logger';
import { splitSongTitles } from './songTitles.util';
import { getActiveParser } from './registry';

const MIN_CONFIDENCE_THRESHOLD = 0.5;

/** Fields a trace step changed (key → new value), comparing metadata before/after a stage. */
function diffMetadata(
  before: Partial<ParsedMetadata>,
  after: Partial<ParsedMetadata>,
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  for (const key of Object.keys(after) as Array<keyof ParsedMetadata>) {
    if (key === 'confidence') continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = after[key];
    }
  }
  return changes;
}

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

export class ParserService implements IParser {
  constructor(
    private modules: ParserModule[],
    private dictionaryModule?: DictionaryModule,
  ) {}

  async parseTitle(title: string, publishedAt?: string, tags?: string[], description?: string) {
    const trace: ParserTraceStep[] = [];

    const normalizedTitle = title.trim().toLowerCase();
    if (normalizedTitle === 'private video') {
      return {
        metadata: {
          is_fancam: false,
          fancam_confidence: 1,
          confidence: 0,
        },
        needsReview: true,
        trace: [
          { stage: 'Short-circuit', detail: '"private video" → unparseable, flagged for review' },
        ],
      };
    }

    let currentMetadata: Partial<ParsedMetadata> = {};

    for (const module of this.modules) {
      const before = { ...currentMetadata };
      try {
        const result = await module.parse(title, currentMetadata);
        for (const key of Object.keys(result.metadata) as Array<keyof ParsedMetadata>) {
          if (key === 'confidence') continue;
          const value = result.metadata[key];
          if (value !== undefined && value !== null && value !== '') {
            (currentMetadata as any)[key] = value;
          }
        }
        trace.push({
          stage: module.constructor.name,
          changes: diffMetadata(before, currentMetadata),
          confidence: result.confidence,
        });
      } catch (error) {
        logger.warn('Parser module failed:', error);
        trace.push({
          stage: module.constructor.name,
          detail: `failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        });
      }
    }

    // The "artist" token can actually name the group itself: "(I.O.I FanCam)" (regex guesses
    // SOLO for a single-name credit) or "IVE 아이브 직캠" (the group's own Korean alias trails its
    // Latin name). When it resolves to a group, it's a group-only credit — promote it to the
    // group when none is set / SOLO, otherwise just drop the bogus artist.
    if (currentMetadata.artist_name && this.dictionaryModule) {
      const credited = currentMetadata.artist_name;
      const group = await this.dictionaryModule.resolveGroupOnlyCredit(credited);
      if (group) {
        if (!currentMetadata.group_name || currentMetadata.group_name === SOLO_GROUP) {
          currentMetadata.group_name = group;
          delete currentMetadata.artist_name;
          trace.push({
            stage: 'Group-only credit',
            detail: `"${credited}" is a group → promoted to group_name, artist dropped`,
            changes: { group_name: group, artist_name: undefined },
          });
        } else if (currentMetadata.group_name === group) {
          delete currentMetadata.artist_name;
          trace.push({
            stage: 'Group-only credit',
            detail: `"${credited}" duplicates the group → artist dropped`,
            changes: { artist_name: undefined },
          });
        }
      }
    }

    if (tags?.length && this.dictionaryModule) {
      const before = { ...currentMetadata };
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
      const changes = diffMetadata(before, currentMetadata);
      if (Object.keys(changes).length) {
        trace.push({ stage: 'YouTube tags', detail: 'filled empty fields from tags', changes });
      }
    }

    // The description often credits the performer/song when the title doesn't — use it as a
    // last-resort source for identity fields the title (and tags) left empty.
    if (description?.trim() && this.dictionaryModule) {
      const before = { ...currentMetadata };
      if (!currentMetadata.group_name && !currentMetadata.artist_name) {
        const artist = await this.dictionaryModule.searchInText(description, 'artist');
        if (artist) {
          currentMetadata.artist_name = artist.name;
          if (artist.group) {
            currentMetadata.group_name = artist.group;
          }
        } else {
          const group = await this.dictionaryModule.searchInText(description, 'group');
          if (group) {
            currentMetadata.group_name = group;
          }
        }
      }
      if (!currentMetadata.song_title) {
        const song = await this.dictionaryModule.searchInText(description, 'song');
        if (song) {
          currentMetadata.song_title = song;
        }
      }
      const changes = diffMetadata(before, currentMetadata);
      if (Object.keys(changes).length) {
        trace.push({
          stage: 'Description',
          detail: 'filled empty identity/song fields from the description',
          changes,
        });
      }
    }

    const beforeSplit = { ...currentMetadata };
    const parsedSongTitles = splitSongTitles(
      currentMetadata.song_title,
      currentMetadata.song_titles,
    );
    if (parsedSongTitles.length > 0) {
      currentMetadata.song_titles = parsedSongTitles;
      currentMetadata.song_title = parsedSongTitles[parsedSongTitles.length - 1];
      const changes = diffMetadata(beforeSplit, currentMetadata);
      if (Object.keys(changes).length) {
        trace.push({
          stage: 'Song split',
          detail: `split into ${parsedSongTitles.length} song(s)`,
          changes,
        });
      }
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

      if (isOwnGroupSong !== undefined || isOwnArtistSong !== undefined) {
        trace.push({
          stage: 'Song ownership',
          detail: 'checked whether the song belongs to the credited group/artist',
          changes: {
            ...(isOwnGroupSong !== undefined ? { is_own_group_song: isOwnGroupSong } : {}),
            ...(isOwnArtistSong !== undefined ? { is_own_artist_song: isOwnArtistSong } : {}),
          },
        });
      }
    }

    const confidence = calculateMetadataConfidence(currentMetadata);
    currentMetadata.confidence = confidence;

    const lowConfidence = confidence < MIN_CONFIDENCE_THRESHOLD;
    const missingRequired = !hasRequiredFields(currentMetadata, title, publishedAt);
    const unresolvedAliases = hasUnresolvedCoreAliases(currentMetadata);
    const unresolvedArtist = Boolean(currentMetadata.unresolved_artist);
    const needsReview = missingRequired || lowConfidence || unresolvedAliases || unresolvedArtist;

    const reviewReasons = [
      missingRequired && 'missing required fields',
      lowConfidence && `confidence ${confidence} < ${MIN_CONFIDENCE_THRESHOLD}`,
      unresolvedAliases && 'unresolved Korean alias in group/artist',
      unresolvedArtist && 'artist named in title is not a member of the identified group',
    ].filter(Boolean) as string[];
    trace.push({
      stage: 'Review decision',
      detail: needsReview
        ? `needs review — ${reviewReasons.join('; ')}`
        : `auto-accepted (confidence ${confidence})`,
      confidence,
    });

    return {
      metadata: currentMetadata,
      needsReview,
      trace,
    };
  }
}

const defaultDictionaryModule = new DictionaryModule();

/**
 * The default regex + dictionary pipeline parser. Registered as the 'pipeline' strategy in
 * services/parser/registry.ts. Exported so the registry can select it without rebuilding modules.
 */
export const pipelineParser = new ParserService(
  [new RegexModule(), defaultDictionaryModule],
  defaultDictionaryModule,
);

/**
 * Parse a title with the ACTIVE parser (selected via PARSER_STRATEGY, see the parser registry).
 * All parse entry points funnel through here, so switching PARSER_STRATEGY changes the parser
 * everywhere without touching callers.
 */
export async function parseTitle(
  title: string,
  publishedAt?: string,
  tags?: string[],
  description?: string,
) {
  return getActiveParser().parseTitle(title, publishedAt, tags, description);
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
