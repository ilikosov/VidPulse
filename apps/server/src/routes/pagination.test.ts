import { describe, it, expect, vi } from 'vitest';
import { getPaginationParams } from './pagination';

describe('getPaginationParams', () => {
  it('clamps invalid page/limit', () => {
    const req: any = { query: { page: '-2', limit: 'abc' } };
    expect(getPaginationParams(req, 20, 100)).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it('caps limit by maxLimit', () => {
    const req: any = { query: { page: '1', limit: '999' } };
    expect(getPaginationParams(req, 20, 100)).toEqual({ page: 1, limit: 100, offset: 0 });
  });
});
