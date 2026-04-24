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
    currentMeta: Partial<ParsedMetadata>
  ): Promise<{ metadata: Partial<ParsedMetadata>; confidence: number }>;
}
