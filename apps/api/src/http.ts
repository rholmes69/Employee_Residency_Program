import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema, z } from 'zod';
import { AppError, type Actor } from '@erp/core';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      actor?: Actor;
    }
  }
}

export function actorOf(req: Request): Actor {
  if (!req.actor) throw new AppError(401, 'Not signed in');
  return req.actor;
}

export function parse<S extends ZodSchema>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (!r.success) throw new AppError(400, 'Invalid input', r.error.flatten().fieldErrors);
  return r.data;
}

/** Express 5 forwards async errors here. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  console.error('[api] unhandled error', err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
