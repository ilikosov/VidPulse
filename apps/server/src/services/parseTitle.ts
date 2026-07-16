import { getParser } from '@vidpulse/parser';
import { config } from '../config';

/**
 * Parse a title with the ACTIVE parser (selected via PARSER_STRATEGY). All parse entry points
 * funnel through here, so switching PARSER_STRATEGY changes the parser everywhere without touching
 * callers. This thin wrapper keeps PARSER_STRATEGY config on the server side — the @vidpulse/parser
 * package is config-agnostic and only knows how to resolve a strategy string.
 */
export async function parseTitle(
  title: string,
  publishedAt?: string,
  tags?: string[],
  description?: string,
) {
  return getParser(config.parser.strategy).parseTitle(title, publishedAt, tags, description);
}
