import { Request, Response, NextFunction } from 'express';

/**
 * Pagination middleware/helper
 * Requirement 9.5: Pagination support with max 100 items per page
 */

export interface PaginationQuery {
  page: number;
  limit: number;
  skip: number;
}

declare global {
  namespace Express {
    interface Request {
      pagination?: PaginationQuery;
    }
  }
}

export function paginationMiddleware(req: Request, _res: Response, next: NextFunction) {
  const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string) || 50));
  const skip = (page - 1) * limit;

  req.pagination = {
    page,
    limit,
    skip
  };

  next();
}
