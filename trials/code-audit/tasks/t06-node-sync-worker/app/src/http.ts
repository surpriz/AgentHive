import { timingSafeEqual } from 'node:crypto';
import express from 'express';
import type { Queue } from 'bullmq';
import { z } from 'zod';
import type { Config } from './config.js';
import type { ExportJob } from './jobs/export.js';

const enqueueInput = z.object({ tenant: z.string().min(1).max(64), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

/** Internal admin API: enqueue an export by hand, read the queue counts. Protected by ADMIN_TOKEN. */
export function adminApi(config: Config, exports: Queue<ExportJob>) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));

  app.use((req, res, next) => {
    const given = Buffer.from(req.header('authorization')?.replace(/^Bearer /, '') ?? '');
    const expected = Buffer.from(config.ADMIN_TOKEN);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return res.status(401).json({ error: 'unauthorized' });
    next();
  });

  app.get('/queue', async (_req, res) => res.json(await exports.getJobCounts()));

  app.post('/jobs', async (req, res) => {
    const parsed = enqueueInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'tenant and day required' });
    const job = await exports.add('export', { ...parsed.data, requestedBy: 'admin-api' });
    res.status(202).json({ id: job.id });
  });

  return app;
}
