/**
 * @vidpulse/parser — pluggable K-pop video-title parsers.
 *
 * Public surface: the parser contract types, the strategy registry (getParser /
 * assertParserStrategy / SUPPORTED_PARSER_STRATEGIES), and the song-title helpers the server's
 * persistence layer shares. The concrete parsers (RegexModule, DictionaryModule, pipelineParser,
 * emptyParser) are internal — the server selects them by strategy via getParser().
 *
 * The package reads the dictionary_* tables through @vidpulse/db but is config-agnostic: the
 * server reads PARSER_STRATEGY and passes the strategy string in.
 */
export type {
  ParsedMetadata,
  ParseResult,
  ParserModule,
  ParserStrategy,
  IParser,
} from './parser.types';
export { getParser, assertParserStrategy, SUPPORTED_PARSER_STRATEGIES } from './registry';
export { splitSongTitles, dedupeTitlesCaseInsensitive } from './songTitles.util';
