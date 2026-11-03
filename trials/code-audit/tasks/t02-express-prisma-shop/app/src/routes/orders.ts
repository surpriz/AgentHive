import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/db.js';
import { stripe } from '../lib/stripe.js';
import { requireAuth } from '../middleware/auth.js';

export const ordersRouter = Router();

const checkoutInput = z.object({ items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(20) })).min(1).max(20) });

ordersRouter.get('/', requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({ where: { userId: req.user!.id }, include: { items: true }, orderBy: { createdAt: 'desc' } });
  res.json(orders);
});

ordersRouter.get('/:id', requireAuth, async (req, res) => {
  const order = await prisma.order.findFirst({ where: { id: req.params.id, userId: req.user!.id }, include: { items: true } });
  if (!order) return res.status(404).json({ error: 'not found' });
  res.json(order);
});

ordersRouter.post('/checkout', requireAuth, async (req, res) => {
  const parsed = checkoutInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid cart' });
  const ids = parsed.data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: ids }, active: true } });
  if (products.length !== ids.length) return res.status(400).json({ error: 'unknown product' });
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = parsed.data.items.map((i) => ({ productId: i.productId, quantity: i.quantity, priceCents: byId.get(i.productId)!.priceCents }));
  const totalCents = items.reduce((s, i) => s + i.priceCents * i.quantity, 0);

  const order = await prisma.order.create({ data: { userId: req.user!.id, totalCents, items: { create: items } } });
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: `${process.env.APP_URL}/orders/${order.id}?paid=1`,
    cancel_url: `${process.env.APP_URL}/cart`,
    line_items: items.map((i) => ({ quantity: i.quantity, price_data: { currency: 'eur', unit_amount: i.priceCents, product_data: { name: byId.get(i.productId)!.name } } })),
    metadata: { orderId: order.id },
  });
  await prisma.order.update({ where: { id: order.id }, data: { stripeSessionId: session.id } });
  res.json({ url: session.url });
});
