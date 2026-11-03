import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const productsRouter = Router();

productsRouter.get('/', async (_req, res) => {
  const products = await prisma.product.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  res.json(products);
});

// Free-text search, used by the storefront search box.
productsRouter.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json([]);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT id, slug, name, "priceCents" FROM "Product" WHERE active = true AND (name ILIKE '%${q}%' OR description ILIKE '%${q}%') ORDER BY name LIMIT 50`,
  );
  res.json(rows);
});

productsRouter.get('/:slug', async (req, res) => {
  const product = await prisma.product.findUnique({ where: { slug: req.params.slug } });
  if (!product || !product.active) return res.status(404).json({ error: 'not found' });
  res.json(product);
});

const productInput = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,60}$/),
  name: z.string().min(1).max(120),
  description: z.string().max(5000).default(''),
  priceCents: z.number().int().min(0).max(10_000_000),
  stock: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
});

productsRouter.post('/', requireAuth, requireRole('STAFF', 'ADMIN'), async (req, res) => {
  const parsed = productInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid product' });
  const product = await prisma.product.create({ data: parsed.data });
  res.status(201).json(product);
});
