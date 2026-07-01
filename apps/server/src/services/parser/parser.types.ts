import type { ParserTraceStep } from '@vidpulse/shared';

/**
 * Parsed metadata from a video title
 */
export interface ParsedMetadata {
  perf_date?: string; // YYMMDD format
  group_name?: string;
  artist_name?: string; // For solo fancams
  song_title?: string;
  song_titles?: string[];
  event?: string; // With @ prefix, e.g. @MCOUNTDOWN
  camera_type?: string; // e.g. vertical fancam, 4K, 입덕직캠
  is_fancam?: boolean;
  fancam_confidence?: number;
  confidence?: number; // 0-1 confidence score
  // Whether the parsed song is linked to the parsed group in the media library.
  is_own_group_song?: boolean;
  // Whether the parsed song is linked to the parsed artist in the media library.
  is_own_artist_song?: boolean;
  // Internal: an artist was named in the title but isn't a member of the identified group, so
  // we left artist_name empty instead of guessing a look-alike → force review. Not persisted
  // (no DB column maps to it); surfaces only in the parser trace.
  unresolved_artist?: boolean;
}

/**
 * The pinned parser contract result. Every parser implementation (see IParser) returns this shape:
 * raw parsed names as evidence (metadata), a review flag, and a stage-by-stage trace. Linking the
 * raw names to canonical dictionary IDs is a separate, parser-agnostic step (resolveParsedMetadata),
 * so swapping the parser never bypasses the media-library dictionary.
 */
export interface ParseResult {
  metadata: Partial<ParsedMetadata>;
  needsReview: boolean;
  trace: ParserTraceStep[];
}

/**
 * Identifiers of the selectable parser implementations (see the parser registry). Extend this union
 * when adding a strategy (e.g. 'llm') and register it in services/parser/registry.ts.
 */
export type ParserStrategy = 'pipeline';

/**
 * Parser module interface for multi-stage parsing
 */
export interface ParserModule {
  /**
   * Parse a title and return updated metadata with confidence score
   * @param title - The original video title
   * @param currentMeta - Metadata already extracted by previous modules
   * @returns Updated metadata and confidence score
   */
  parse(
    title: string,
    currentMeta: Partial<ParsedMetadata>,
  ): Promise<{ metadata: Partial<ParsedMetadata>; confidence: number }>;
}
