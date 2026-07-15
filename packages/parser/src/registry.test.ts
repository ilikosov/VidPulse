import { describe, expect, it, vi } from 'vitest';

// pipelineParser pulls in DictionaryModule, which imports `knex` from @vidpulse/db; loading the
// real package eagerly opens its connection and throws on the missing DATABASE_PATH env. The
// registry only needs the parser instances' identity here, so a stub knex is enough.
vi.mock('@vidpulse/db', () => ({ knex: () => ({}) }));

import { assertParserStrategy, getParser, SUPPORTED_PARSER_STRATEGIES } from './registry';
import { emptyParser } from './emptyParser.service';
import { pipelineParser } from './parser.service';

describe('parser registry', () => {
  it('resolves the pipeline parser for the default strategy', () => {
    expect(getParser('pipeline')).toBe(pipelineParser);
    expect(assertParserStrategy('pipeline')).toBe('pipeline');
  });

  it('resolves the pinned pipeline v1 parser version', () => {
    expect(getParser('pipeline-v1')).toBe(pipelineParser);
    expect(assertParserStrategy('pipeline-v1')).toBe('pipeline-v1');
  });

  it('resolves the deterministic empty parser', async () => {
    expect(getParser('empty')).toBe(emptyParser);
    expect(assertParserStrategy('empty')).toBe('empty');

    await expect(getParser('empty').parseTitle('anything')).resolves.toMatchObject({
      metadata: { is_fancam: false, fancam_confidence: 0, confidence: 0 },
      needsReview: true,
    });
  });

  it('throws a helpful error for an unknown strategy', () => {
    expect(() => getParser('bogus')).toThrow(/Unknown PARSER_STRATEGY "bogus"/);
    expect(() => assertParserStrategy('bogus')).toThrow(/Supported: pipeline/);
  });

  it('exposes the supported strategy names', () => {
    expect(SUPPORTED_PARSER_STRATEGIES).toContain('pipeline');
    expect(SUPPORTED_PARSER_STRATEGIES).toContain('pipeline-v1');
    expect(SUPPORTED_PARSER_STRATEGIES).toContain('empty');
  });
});
