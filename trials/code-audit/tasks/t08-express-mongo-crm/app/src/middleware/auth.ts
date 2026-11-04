import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { HttpError } from './errors.js';

export type Role = 'agent' | 'manager' | 'admin';

export interface AuthUser {
  id: string;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) throw new Error('JWT_SECRET must be set and at least 32 characters');

export const sign = (user: AuthUser) => jwt.sign({ sub: user.id, role: user.role }, SECRET!, { algorithm: 'HS256', expiresIn: '12h' });

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new HttpError(401, 'unauthorized'));
  try {
    const payload = jwt.verify(token, SECRET!, { algorithms: ['HS256'] }) as { sub: string; role: Role };
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new HttpError(401, 'unauthorized'));
  }
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) =>
    req.user && roles.includes(req.user.role) ? next() : next(new HttpError(403, 'forbidden'));
