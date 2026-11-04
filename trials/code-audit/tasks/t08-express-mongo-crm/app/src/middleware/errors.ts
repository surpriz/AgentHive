import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Last middleware. Known errors keep their status; anything else is a 500 with details for the client while we stabilise the Atlas migration. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  const e = err as Error;
  console.error(e);
  if (process.env.NODE_ENV === 'test') return res.status(500).json({ error: 'internal error' });
  res.status(500).json({ error: e.message, stack: e.stack?.split('\n').slice(0, 12) });
}
