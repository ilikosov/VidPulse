import { config } from '../../config';
import type { IParser } from '../../interfaces/services';
import { pipelineParser } from './parser.service';

/**
 * Registry of selectable parser implementations, keyed by PARSER_STRATEGY value. Each entry is a
 * lazy factory so a strategy that is expensive to build (or not always used) is only instantiated
 * when selected. To add a parser: implement IParser and register it here (e.g. `llm: () => llmParser`),
 * then extend the ParserStrategy union in parser.types.ts and document PARSER_STRATEGY.
 *
 * The factories reference the parser instances lazily (at call time), which keeps the
 * parser.service ↔ registry import cycle safe — neither module touches the other during init.
 */
const registry: Record<string, () => IParser> = {
  pipeline: () => pipelineParser,
  // llm: () => llmParser,  // TODO(ADR 0006): dictionary-normalized LLM parser; PARSER_STRATEGY=everywhere.
};

/** The strategy names currently wired in the registry (for validation and error messages). */
export const SUPPORTED_PARSER_STRATEGIES = Object.keys(registry);

/**
 * Resolve the parser selected by config.parser.strategy (PARSER_STRATEGY). Throws on an unknown
 * value so a typo fails loudly instead of silently falling back.
 */
export function getActiveParser(): IParser {
  const factory = registry[config.parser.strategy];
  if (!factory) {
    throw new Error(
      `Unknown PARSER_STRATEGY "${config.parser.strategy}". ` +
        `Supported: ${SUPPORTED_PARSER_STRATEGIES.join(', ')}`,
    );
  }
  return factory();
}

/** Fail-fast startup guard: validates PARSER_STRATEGY and returns the active strategy name. */
export function assertParserStrategy(): string {
  getActiveParser();
  return config.parser.strategy;
}
