import { ParsedMetadata, ParserModule } from './parser.types';
import { RegexModule } from './regex.module';
import { DictionaryModule } from './dictionary.module';

const MIN_CONFIDENCE_THRESHOLD = 0.5;

function hasRequiredFields(metadata: Partial<ParsedMetadata>): boolean {
  return !!(metadata.group_name || metadata.artist_name) && !!metadata.song_title && !!metadata.perf_date;
}

export class ParserService {
  constructor(private modules: ParserModule[], private dictionaryModule?: DictionaryModule) {}

  async parseTitle(title: string, publishedAt?: string, tags?: string[]) {
    void publishedAt;
    let currentMetadata: Partial<ParsedMetadata> = {};
    let totalConfidence = 0;
    let moduleCount = 0;

    for (const module of this.modules) {
      try {
        const result = await module.parse(title, currentMetadata);
        for (const key of Object.keys(result.metadata) as Array<keyof ParsedMetadata>) {
          if (key === 'confidence') continue;
          const value = result.metadata[key];
          if (value !== undefined && value !== null && value !== '') (currentMetadata as any)[key] = value;
        }
        totalConfidence += result.confidence;
        moduleCount++;
      } catch (error) {
        console.warn('Parser module failed:', error);
      }
    }

    if (tags?.length && this.dictionaryModule) {
      if (!currentMetadata.group_name && !currentMetadata.artist_name) {
        currentMetadata.group_name = this.dictionaryModule.searchInTags(tags, 'group') || currentMetadata.group_name;
        currentMetadata.artist_name = this.dictionaryModule.searchInTags(tags, 'artist') || currentMetadata.artist_name;
      }
      currentMetadata.song_title = currentMetadata.song_title || this.dictionaryModule.searchInTags(tags, 'song') || currentMetadata.song_title;
      currentMetadata.event = currentMetadata.event || this.dictionaryModule.searchInTags(tags, 'event') || currentMetadata.event;
    }

    const avgConfidence = moduleCount > 0 ? totalConfidence / moduleCount : 0;
    currentMetadata.confidence = avgConfidence;
    return { metadata: currentMetadata, needsReview: !hasRequiredFields(currentMetadata) || avgConfidence < MIN_CONFIDENCE_THRESHOLD };
  }
}

const defaultDictionaryModule = new DictionaryModule();
const defaultParserService = new ParserService([new RegexModule(), defaultDictionaryModule], defaultDictionaryModule);

export async function parseTitle(title: string, publishedAt?: string, tags?: string[]) {
  return defaultParserService.parseTitle(title, publishedAt, tags);
}

export function validateField(field: keyof ParsedMetadata, value: string | undefined): { valid: boolean; normalizedValue?: string } {
  if (!value) return { valid: false };
  switch (field) {
    case 'perf_date': return { valid: /^(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(value), normalizedValue: value };
    case 'event': return { valid: true, normalizedValue: (value.startsWith('@') ? value : '@' + value).toUpperCase() };
    case 'group_name': case 'artist_name': case 'song_title': case 'camera_type': return { valid: true, normalizedValue: value.trim() };
    default: return { valid: true, normalizedValue: value };
  }
}
