import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { errorHandler, notFoundHandler } from './errorHandler';
import { AppError } from './AppError';
import * as loggerModule from '../lib/logger';

beforeEach(() => {
  vi.spyOn(loggerModule.logger, 'error').mockImplementation(() => undefined);
});

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;
  (res.status as ReturnType<typeof vi.fn>).mockReturnValue(res);
  return res;
}

function mockReq(method = 'GET', path = '/api/test') {
  return { method, path } as Request;
}

describe('notFoundHandler', () => {
  it('returns 404 with NOT_FOUND code', () => {
    const req = mockReq('GET', '/api/missing');
    const res = mockRes();
    notFoundHandler(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({ code: 'NOT_FOUND' }),
    });
  });
});

describe('errorHandler', () => {
  const next = vi.fn() as unknown as NextFunction;

  it('handles AppError with correct status and shape', () => {
    const err = new AppError(422, 'Validation failed', 'VALIDATION_ERROR');
    const res = mockRes();
    errorHandler(err, mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Validation failed', code: 'VALIDATION_ERROR' },
    });
  });

  it('handles AppError without code', () => {
    const err = new AppError(404, 'Not found');
    const res = mockRes();
    errorHandler(err, mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect((res.json as ReturnType<typeof vi.fn>).mock.calls[0][0]).toEqual({
      error: { message: 'Not found' },
    });
  });

  it('handles generic Error as 500', () => {
    const err = new Error('Something broke');
    const res = mockRes();
    errorHandler(err, mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
    });
  });

  it('handles non-Error thrown value as 500', () => {
    const res = mockRes();
    errorHandler('oops', mockReq(), res, next);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('AppError helpers', () => {
  it('notFound produces 404', () => {
    const e = AppError.notFound();
    expect(e.statusCode).toBe(404);
    expect(e.code).toBe('NOT_FOUND');
  });

  it('badRequest produces 400', () => {
    const e = AppError.badRequest('bad input');
    expect(e.statusCode).toBe(400);
    expect(e.message).toBe('bad input');
  });
});
