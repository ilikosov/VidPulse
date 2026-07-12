import type { ParserTraceStep } from '@vidpulse/shared';
import type { IParser } from '../../interfaces/services';
import type { ParseResult } from './parser.types';

const EMPTY_PARSER_TRACE: ParserTraceStep[] = [
  {
    stage: 'EmptyParser',
    detail: 'static parser selected: returns the same placeholder metadata for every title',
    confidence: 0,
  },
];

/**
 * Deterministic no-op parser for smoke tests, UI checks and parser-switching verification.
 * It intentionally ignores the input and always returns the same low-confidence placeholder.
 */
export class EmptyParser implements IParser {
  async parseTitle(): Promise<ParseResult> {
    return {
      metadata: {
        is_fancam: false,
        fancam_confidence: 0,
        confidence: 0,
      },
      needsReview: true,
      trace: EMPTY_PARSER_TRACE.map((step) => ({ ...step })),
    };
  }
}

export const emptyParser = new EmptyParser();
