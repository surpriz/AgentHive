import { Router } from 'express';
import { z } from 'zod';
import { escapeRegex, pick } from '../lib/pick.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { Contact } from '../models/contact.js';

export const contactsRouter = Router();
contactsRouter.use(requireAuth);

const contactInput = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200).optional(),
  company: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  notes: z.string().max(5000).optional(),
});

/** Agents see their own contacts; managers and admins see everyone's. */
const scope = (user: { id: string; role: string }) => (user.role === 'agent' ? { owner: user.id } : {});

contactsRouter.get('/', async (req, res, next) => {
  try {
    const contacts = await Contact.find(scope(req.user!)).sort({ updatedAt: -1 }).limit(200);
    res.json(contacts);
  } catch (err) {
    next(err);
  }
});

/** Prefix search on company, used by the deal form's autocomplete. */
contactsRouter.get('/companies', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim().slice(0, 60);
    if (!q) return res.json([]);
    const rows = await Contact.find({ ...scope(req.user!), company: { $regex: `^${escapeRegex(q)}`, $options: 'i' } }, { company: 1 }).limit(10);
    res.json([...new Set(rows.map((r) => r.company))]);
  } catch (err) {
    next(err);
  }
});

/** Free-text search across name, email, company and notes. Matches anywhere, any case. */
contactsRouter.get('/search', async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (!q) return res.json([]);
    const needle = q.toLowerCase();
    const rows = await Contact.find({
      ...scope(req.user!),
      $where: `['name','email','company','notes'].some(k => String(this[k] || '').toLowerCase().includes('${needle}'))`,
    }).limit(50);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

contactsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = contactInput.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'invalid contact');
    const contact = await Contact.create({ ...parsed.data, owner: req.user!.id });
    res.status(201).json(contact);
  } catch (err) {
    next(err);
  }
});

contactsRouter.patch('/:id', async (req, res, next) => {
  try {
    const changes = pick(req.body as Record<string, unknown>, ['name', 'email', 'company', 'phone', 'notes'] as const);
    const parsed = contactInput.partial().safeParse(changes);
    if (!parsed.success) throw new HttpError(400, 'invalid contact');
    const contact = await Contact.findOneAndUpdate({ _id: req.params.id, ...scope(req.user!) }, parsed.data, { new: true });
    if (!contact) throw new HttpError(404, 'not found');
    res.json(contact);
  } catch (err) {
    next(err);
  }
});

contactsRouter.delete('/:id', requireRole('manager', 'admin'), async (req, res, next) => {
  try {
    const gone = await Contact.findByIdAndDelete(req.params.id);
    if (!gone) throw new HttpError(404, 'not found');
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
