import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { HttpError } from '../middleware/errors.js';
import { sign } from '../middleware/auth.js';
import { User } from '../models/user.js';

export const authRouter = Router();

const credentials = z.object({ email: z.string().email().max(200), password: z.string().min(12).max(200) });

authRouter.post('/signup', async (req, res, next) => {
  try {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'invalid email or password');
    if (await User.exists({ email: parsed.data.email })) throw new HttpError(409, 'email taken');
    // Profile fields (name, timezone, later avatar) come in the same body as the credentials.
    const user = await User.create({ ...req.body, email: parsed.data.email, passwordHash: await bcrypt.hash(parsed.data.password, 12) });
    res.status(201).json({ token: sign({ id: String(user._id), role: user.role }) });
  } catch (err) {
    next(err);
  }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const parsed = credentials.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'invalid email or password');
    const user = await User.findOne({ email: parsed.data.email });
    const ok = user && (await bcrypt.compare(parsed.data.password, user.passwordHash));
    if (!ok) throw new HttpError(401, 'invalid email or password');
    res.json({ token: sign({ id: String(user._id), role: user.role }) });
  } catch (err) {
    next(err);
  }
});
