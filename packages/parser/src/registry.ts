import type { IParser, ParserStrategy } from './parser.types';
import { emptyParser } from './emptyParser.service';
import { pipelineParser } from './parser.service';

/**
 * Registry of selectable parser implementations, keyed by PARSER_STRATEGY value. Each entry is a
 * lazy factory so a strategy that is expensive to build (or not always used) is only instantiated
 * when selected. Keep stable aliases (e.g. `pipeline`) pointed at the production default, and
 * expose immutable version keys (e.g. `pipeline-v1`) when callers need to compare parser versions.
 * `empty` is a deterministic no-op parser for smoke tests and parser-switching verification.
 * To add a parser: implement IParser and register it here (e.g. `llm: () => llmParser`), then
 * extend the ParserStrategy union in parser.types.ts.
 *
 * The package is config-agnostic: the server reads PARSER_STRATEGY and passes the strategy string
 * to getParser()/assertParserStrategy(). Factories reference the parser instances lazily, which
 * keeps the parser.service ↔ registry import cycle safe (neither touches the other during init).
 */
const registry: Record<ParserStrategy, () => IParser> = {
  pipeline: () => pipelineParser,
  'pipeline-v1': () => pipelineParser,
  empty: () => emptyParser,
  // llm: () => llmParser,  // TODO(ADR 0006): dictionary-normalized LLM parser.
};

/** The strategy names currently wired in the registry (for validation and error messages). */
export const SUPPORTED_PARSER_STRATEGIES = Object.keys(registry);

/**
 * Resolve the parser for `strategy` (the server passes config.parser.strategy / PARSER_STRATEGY).
 * Throws on an unknown value so a typo fails loudly instead of silently falling back.
 */
export function getParser(strategy: string): IParser {
  const factory = registry[strategy as ParserStrategy];
  if (!factory) {
    throw new Error(
      `Unknown PARSER_STRATEGY "${strategy}". Supported: ${SUPPORTED_PARSER_STRATEGIES.join(', ')}`,
    );
  }
  return factory();
}

/** Fail-fast startup guard: validates the strategy and returns it. */
export function assertParserStrategy(strategy: string): string {
  getParser(strategy);
  return strategy;
}
