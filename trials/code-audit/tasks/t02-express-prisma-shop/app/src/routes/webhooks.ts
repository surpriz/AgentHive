import { Router } from 'express';
import { prisma } from '../lib/db.js';

export const webhooksRouter = Router();

interface CheckoutEvent {
  type: string;
  data: { object: { id: string; payment_status?: string; metadata?: { orderId?: string } } };
}

// Stripe posts here when a checkout session completes. Raw body is mounted in server.ts.
webhooksRouter.post('/stripe', async (req, res) => {
  let event: CheckoutEvent;
  try {
    event = JSON.parse((req.body as Buffer).toString('utf8')) as CheckoutEvent;
  } catch {
    return res.status(400).json({ error: 'bad payload' });
  }
  if (event.type !== 'checkout.session.completed') return res.json({ received: true });

  const session = event.data.object;
  const orderId = session.metadata?.orderId;
  if (!orderId) return res.status(400).json({ error: 'missing order' });
  await prisma.order.update({ where: { id: orderId }, data: { status: 'PAID', stripeSessionId: session.id } });
  res.json({ received: true });
});
