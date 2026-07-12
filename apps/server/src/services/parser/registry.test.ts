import { afterEach, describe, expect, it } from 'vitest';
import { assertParserStrategy, getActiveParser, SUPPORTED_PARSER_STRATEGIES } from './registry';
import { emptyParser } from './emptyParser.service';
import { pipelineParser } from './parser.service';

const original = process.env.PARSER_STRATEGY;
afterEach(() => {
  if (original === undefined) delete process.env.PARSER_STRATEGY;
  else process.env.PARSER_STRATEGY = original;
});

describe('parser registry', () => {
  it('defaults to the pipeline parser when PARSER_STRATEGY is unset', () => {
    delete process.env.PARSER_STRATEGY;
    expect(getActiveParser()).toBe(pipelineParser);
  });

  it('selects pipeline explicitly, trimming/lowercasing the value', () => {
    process.env.PARSER_STRATEGY = '  Pipeline  ';
    expect(getActiveParser()).toBe(pipelineParser);
    expect(assertParserStrategy()).toBe('pipeline');
  });

  it('selects the pinned pipeline v1 parser version explicitly', () => {
    process.env.PARSER_STRATEGY = 'pipeline-v1';
    expect(getActiveParser()).toBe(pipelineParser);
    expect(assertParserStrategy()).toBe('pipeline-v1');
  });

  it('selects the deterministic empty parser explicitly', async () => {
    process.env.PARSER_STRATEGY = 'empty';
    expect(getActiveParser()).toBe(emptyParser);
    expect(assertParserStrategy()).toBe('empty');

    await expect(getActiveParser().parseTitle('anything')).resolves.toMatchObject({
      metadata: { is_fancam: false, fancam_confidence: 0, confidence: 0 },
      needsReview: true,
    });
  });

  it('throws a helpful error for an unknown strategy', () => {
    process.env.PARSER_STRATEGY = 'bogus';
    expect(() => getActiveParser()).toThrow(/Unknown PARSER_STRATEGY "bogus"/);
    expect(() => assertParserStrategy()).toThrow(/Supported: pipeline/);
  });

  it('exposes the supported strategy names', () => {
    expect(SUPPORTED_PARSER_STRATEGIES).toContain('pipeline');
    expect(SUPPORTED_PARSER_STRATEGIES).toContain('pipeline-v1');
    expect(SUPPORTED_PARSER_STRATEGIES).toContain('empty');
  });
});
