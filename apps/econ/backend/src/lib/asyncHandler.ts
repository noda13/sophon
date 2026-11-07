import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/**
 * Wraps an async Express route handler so that any rejected promise is
 * forwarded to the next error-handling middleware via next(err).
 * Required in Express 4, which does not automatically catch async rejections.
 */
export const asyncHandler = (fn: AsyncRequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
