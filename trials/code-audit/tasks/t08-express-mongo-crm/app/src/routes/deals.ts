import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { Contact } from '../models/contact.js';
import { Deal } from '../models/deal.js';

export const dealsRouter = Router();
dealsRouter.use(requireAuth);

const dealInput = z.object({
  contact: z.string().regex(/^[0-9a-f]{24}$/),
  title: z.string().min(1).max(200),
  amountCents: z.number().int().min(0).max(1_000_000_000),
  stage: z.enum(['lead', 'qualified', 'proposal', 'won', 'lost']).optional(),
});

const scope = (user: { id: string; role: string }) => (user.role === 'agent' ? { owner: user.id } : {});

dealsRouter.get('/', async (req, res, next) => {
  try {
    res.json(await Deal.find(scope(req.user!)).populate('contact', 'name company').sort({ updatedAt: -1 }).limit(200));
  } catch (err) {
    next(err);
  }
});

dealsRouter.post('/', async (req, res, next) => {
  try {
    const parsed = dealInput.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'invalid deal');
    const contact = await Contact.findOne({ _id: parsed.data.contact, ...scope(req.user!) });
    if (!contact) throw new HttpError(404, 'unknown contact');
    const deal = await Deal.create({ ...parsed.data, owner: req.user!.id });
    res.status(201).json(deal);
  } catch (err) {
    next(err);
  }
});

dealsRouter.patch('/:id/stage', async (req, res, next) => {
  try {
    const parsed = dealInput.pick({ stage: true }).required().safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'invalid stage');
    const deal = await Deal.findOneAndUpdate({ _id: req.params.id, ...scope(req.user!) }, { stage: parsed.data.stage }, { new: true });
    if (!deal) throw new HttpError(404, 'not found');
    res.json(deal);
  } catch (err) {
    next(err);
  }
});
