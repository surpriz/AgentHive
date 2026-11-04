import express from 'express';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { errorHandler } from './middleware/errors.js';
import { authRouter } from './routes/auth.js';
import { contactsRouter } from './routes/contacts.js';
import { dealsRouter } from './routes/deals.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '200kb' }));

app.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }));

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/auth', authRouter);
app.use('/contacts', contactsRouter);
app.use('/deals', dealsRouter);
app.use(errorHandler);

await mongoose.connect(process.env.MONGODB_URI!);
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`pipeline-crm on ${port}`));
