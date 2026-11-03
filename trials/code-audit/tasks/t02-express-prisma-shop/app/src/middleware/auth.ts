import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: string;
  role: 'CUSTOMER' | 'STAFF' | 'ADMIN';
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

export function sign(user: AuthUser): string {
  return jwt.sign({ sub: user.id, role: user.role }, SECRET!, { algorithm: 'HS256', expiresIn: '7d' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const payload = jwt.verify(token, SECRET!, { algorithms: ['HS256'] }) as { sub: string; role: AuthUser['role'] };
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

export function requireRole(...roles: AuthUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  };
}
