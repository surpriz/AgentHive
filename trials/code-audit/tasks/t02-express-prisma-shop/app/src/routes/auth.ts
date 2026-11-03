import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { sign } from '../middleware/auth.js';

export const authRouter = Router();

const credentials = z.object({ email: z.string().email().max(200), password: z.string().min(10).max(200) });

authRouter.post('/signup', async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid email or password' });
  const { email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'email taken' });
  const user = await prisma.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 12) } });
  res.status(201).json({ token: sign({ id: user.id, role: user.role }) });
});

authRouter.post('/login', async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid email or password' });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const ok = user && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!ok) return res.status(401).json({ error: 'invalid email or password' });
  res.json({ token: sign({ id: user.id, role: user.role }) });
});
