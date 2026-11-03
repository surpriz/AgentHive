import express from 'express';
import { authRouter } from './routes/auth.js';
import { productsRouter } from './routes/products.js';
import { usersRouter } from './routes/users.js';
import { ordersRouter } from './routes/orders.js';
import { webhooksRouter } from './routes/webhooks.js';

const app = express();
app.disable('x-powered-by');

// Stripe needs the raw body; everything else is JSON.
app.use('/webhooks', express.raw({ type: 'application/json', limit: '1mb' }), webhooksRouter);
app.use(express.json({ limit: '100kb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authRouter);
app.use('/products', productsRouter);
app.use('/users', usersRouter);
app.use('/orders', ordersRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`merch-api listening on ${port}`));
