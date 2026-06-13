import { Request } from 'express';
import { config } from '../config';

export function getPaginationParams(req: Request, defaultLimit = config.pageSize, maxLimit = 100) {
  const rawPage = Number(req.query.page);
  const rawLimit = Number(req.query.limit);

  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const parsedLimit = Number.isInteger(rawLimit) && rawLimit > 0 ? rawLimit : defaultLimit;
  const limit = Math.min(parsedLimit, maxLimit);
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

export function buildPaginationMeta(page: number, limit: number, total: number) {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}
