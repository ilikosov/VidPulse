import { ParsedMetadata, ParserModule } from './parser.types';
import { RegexModule } from './regex.module';
import { DictionaryModule } from './dictionary.module';

/**
 * Minimum confidence threshold for auto-approval
 */
const MIN_CONFIDENCE_THRESHOLD = 0.5;

/**
 * Required fields that must be present for metadata to be considered complete
 */
function hasRequiredFields(metadata: Partial<ParsedMetadata>): boolean {
  // Must have either group_name OR artist_name
  const hasArtist = !!(metadata.group_name || metadata.artist_name);
  // Must have song_title
  const hasSong = !!metadata.song_title;
  // Must have perf_date
  const hasDate = !!metadata.perf_date;

  return hasArtist && hasSong && hasDate;
}

/**
 * Main parser service that orchestrates multiple parsing modules
 */
export async function parseTitle(
  title: string,
  publishedAt?: string,
  tags?: string[],
): Promise<{ metadata: Partial<ParsedMetadata>; needsReview: boolean }> {
  // publishedAt is accepted for future parser enhancements
  void publishedAt;

  const dictionaryModule = new DictionaryModule();

  // Initialize modules in order
  const modules: ParserModule[] = [new RegexModule(), dictionaryModule];

  // Start with empty metadata
  let currentMetadata: Partial<ParsedMetadata> = {};
  let totalConfidence = 0;
  let moduleCount = 0;

  // Execute modules in sequence
  for (const module of modules) {
    try {
      const result = await module.parse(title, currentMetadata);

      // Merge the results: later modules may normalize/correct earlier extraction
      for (const key of Object.keys(result.metadata) as Array<keyof ParsedMetadata>) {
        if (key === 'confidence') {
          continue;
        }

        const value = result.metadata[key];
        if (value !== undefined && value !== null && value !== '') {
          (currentMetadata as any)[key] = value;
        }
      }

      // Accumulate confidence scores
      totalConfidence += result.confidence;
      moduleCount++;
    } catch (error) {
      console.warn(`Parser module failed:`, error);
      // Continue with next module even if this one fails
    }
  }

  if (tags && tags.length > 0) {
    if (!currentMetadata.group_name && !currentMetadata.artist_name) {
      const groupFromTags = dictionaryModule.searchInTags(tags, 'group');
      if (groupFromTags) {
        currentMetadata.group_name = groupFromTags;
      }

      const artistFromTags = dictionaryModule.searchInTags(tags, 'artist');
      if (artistFromTags) {
        currentMetadata.artist_name = artistFromTags;
      }
    }

    if (!currentMetadata.song_title) {
      const songFromTags = dictionaryModule.searchInTags(tags, 'song');
      if (songFromTags) {
        currentMetadata.song_title = songFromTags;
      }
    }

    if (!currentMetadata.event) {
      const eventFromTags = dictionaryModule.searchInTags(tags, 'event');
      if (eventFromTags) {
        currentMetadata.event = eventFromTags;
      }
    }
  }

  // Calculate average confidence
  const avgConfidence = moduleCount > 0 ? totalConfidence / moduleCount : 0;
  currentMetadata.confidence = avgConfidence;

  // Determine if review is needed
  const needsReview =
    !hasRequiredFields(currentMetadata) || avgConfidence < MIN_CONFIDENCE_THRESHOLD;

  return {
    metadata: currentMetadata,
    needsReview,
  };
}

/**
 * Parse and validate a single field value
 */
export function validateField(
  field: keyof ParsedMetadata,
  value: string | undefined,
): { valid: boolean; normalizedValue?: string } {
  if (!value) {
    return { valid: false };
  }

  switch (field) {
    case 'perf_date':
      // Validate YYMMDD format
      const dateMatch = value.match(/^(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/);
      if (dateMatch) {
        return { valid: true, normalizedValue: value };
      }
      return { valid: false };

    case 'event':
      // Ensure @ prefix
      const normalizedEvent = value.startsWith('@') ? value : '@' + value;
      return { valid: true, normalizedValue: normalizedEvent.toUpperCase() };

    case 'group_name':
    case 'artist_name':
    case 'song_title':
    case 'camera_type':
      return { valid: true, normalizedValue: value.trim() };

    default:
      return { valid: true, normalizedValue: value };
  }
}
