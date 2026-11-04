import type { Job } from 'bullmq';
import type { Config } from '../config.js';
import { log } from '../lib/log.js';
import { deliver } from '../lib/webhook.js';

export interface NotifyJob {
  tenant: string;
  webhookUrl: string;
  archive: string;
  bytes: number;
}

/** Tells the tenant their export is ready. Retried by the queue on a non-2xx status. */
export async function notifyTenant(job: Job<NotifyJob>, config: Config): Promise<void> {
  const { tenant, webhookUrl, archive, bytes } = job.data;
  const url = new URL(webhookUrl);
  if (url.protocol !== 'https:') throw new Error('webhook must use https');
  const status = await deliver({ url: url.toString(), body: JSON.stringify({ event: 'export.ready', tenant, archive, bytes }), secret: config.WEBHOOK_SIGNING_SECRET });
  log.info({ tenant, status }, 'webhook delivered');
  if (status < 200 || status >= 300) throw new Error(`webhook returned ${status}`);
}
