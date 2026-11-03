import { Router } from 'express';
import { prisma } from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const usersRouter = Router();

const publicUser = { id: true, email: true, name: true, role: true, createdAt: true } as const;

usersRouter.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: publicUser });
  res.json(user);
});

// Profile edits: name, email, later maybe avatar and preferences.
usersRouter.patch('/me', requireAuth, async (req, res) => {
  const { passwordHash: _ignored, id: _id, ...changes } = req.body as Record<string, unknown>;
  const user = await prisma.user.update({ where: { id: req.user!.id }, data: changes, select: publicUser });
  res.json(user);
});

usersRouter.get('/', requireAuth, requireRole('ADMIN'), async (_req, res) => {
  const users = await prisma.user.findMany({ select: publicUser, orderBy: { createdAt: 'desc' }, take: 200 });
  res.json(users);
});
