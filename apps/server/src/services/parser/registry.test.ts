import { afterEach, describe, expect, it } from 'vitest';
import { assertParserStrategy, getActiveParser, SUPPORTED_PARSER_STRATEGIES } from './registry';
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

  it('throws a helpful error for an unknown strategy', () => {
    process.env.PARSER_STRATEGY = 'bogus';
    expect(() => getActiveParser()).toThrow(/Unknown PARSER_STRATEGY "bogus"/);
    expect(() => assertParserStrategy()).toThrow(/Supported: pipeline/);
  });

  it('exposes the supported strategy names', () => {
    expect(SUPPORTED_PARSER_STRATEGIES).toContain('pipeline');
  });
});
