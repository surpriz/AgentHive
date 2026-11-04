import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { loadConfig } from './config.js';
import { adminApi } from './http.js';
import { exportTenant, type ExportJob } from './jobs/export.js';
import { notifyTenant, type NotifyJob } from './jobs/notify.js';
import { log } from './lib/log.js';

const config = loadConfig();
const connection = new IORedis(config.REDIS_URL, { maxRetriesPerRequest: null });

const exports = new Queue<ExportJob>('exports', { connection });
const notifications = new Queue<NotifyJob>('notifications', { connection });

new Worker<ExportJob>(
  'exports',
  async (job) => {
    const { archive, bytes } = await exportTenant(job, config);
    const webhookUrl = await lookupWebhook(job.data.tenant);
    if (webhookUrl) await notifications.add('notify', { tenant: job.data.tenant, webhookUrl, archive, bytes }, { attempts: 5, backoff: { type: 'exponential', delay: 30_000 } });
  },
  { connection, concurrency: 2 },
);

new Worker<NotifyJob>('notifications', (job) => notifyTenant(job, config), { connection, concurrency: 4 });

/** Tenant settings live in Redis, written by the main app. */
async function lookupWebhook(tenant: string): Promise<string | null> {
  return connection.hget(`tenant:${tenant}`, 'webhook_url');
}

adminApi(config, exports).listen(9090, '127.0.0.1', () => log.info('admin api on 127.0.0.1:9090'));
