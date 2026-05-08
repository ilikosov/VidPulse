/**
 * Parsed metadata from a video title
 */
export interface ParsedMetadata {
  perf_date?: string; // YYMMDD format
  group_name?: string;
  artist_name?: string; // For solo fancams
  song_title?: string;
  event?: string; // With @ prefix, e.g. @MCOUNTDOWN
  camera_type?: string; // e.g. vertical fancam, 4K, 입덕직캠
  confidence?: number; // 0-1 confidence score
}

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

export type CamType =
  | 'fancam'
  | 'facecam'
  | 'focus'
  | 'choreography'
  | 'fullcam'
  | 'towercam'
  | 'stage_practice'
  | 'dance_practice'
  | 'unknown';

export type ReviewStatus = 'auto_accepted' | 'needs_review' | 'rejected';

export type EntityType = 'group' | 'artist' | 'song' | 'event' | 'location' | 'camera_type';

export interface EntityMatch {
  id: number | string;
  entityType: EntityType;
  canonicalName: string;
  matchedAlias: string;
  language: 'ko' | 'en' | 'ja' | 'mixed' | 'unknown';
  confidence: number;
}

export interface CandidateEntity {
  rawText: string;
  entityType: EntityType;
  confidence: number;
  status: 'candidate';
}

export interface ParsedDate {
  raw: string;
  isoDate: string | null;
  yymmdd: string | null;
  precision: 'day' | 'month' | 'year' | 'unknown';
  confidence: number;
}

export interface VideoParserInput {
  title: string;
  channelName?: string;
  description?: string;
  hashtags?: string[];
  publishedAt?: string;
  videoUrl?: string;
}

export interface ParsedVideoTitle {
  source: VideoParserInput;
  classification: {
    isKpopFancam: boolean;
    camType: CamType;
    confidence: number;
    reasons: string[];
  };
  entities: {
    group: EntityMatch | null;
    artist: EntityMatch | null;
    song: EntityMatch | null;
    event: EntityMatch | null;
    location: EntityMatch | null;
    date: ParsedDate | null;
  };
  approval: {
    status: ReviewStatus;
    reviewReasons: string[];
  };
  candidates: {
    possibleGroups: CandidateEntity[];
    possibleArtists: CandidateEntity[];
    possibleSongs: CandidateEntity[];
    possibleEvents: CandidateEntity[];
  };
  normalizedTitle: string;
}
