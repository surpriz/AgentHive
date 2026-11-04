import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import type { Job } from 'bullmq';
import type { Config } from '../config.js';
import { log, redacted } from '../lib/log.js';
import { run } from '../lib/shell.js';

const sh = promisify(exec);

export interface ExportJob {
  tenant: string;
  /** ISO date of the snapshot to export. */
  day: string;
  requestedBy: string;
}

/** Dumps a tenant's tables to CSV, packs them, and uploads the archive. */
export async function exportTenant(job: Job<ExportJob>, config: Config): Promise<{ archive: string; bytes: number }> {
  const { tenant, day } = job.data;
  log.info({ job: redacted(job.data as unknown as Record<string, unknown>) }, 'export started');

  const workdir = path.join(config.EXPORT_ROOT, tenant, day);
  await run('mkdir', ['-p', workdir]);
  await run('pg_dump', ['--data-only', '--format=csv', `--schema=tenant_${tenant}`, '--file', path.join(workdir, 'data.csv')]);

  // Pack with the tenant's own retention flags from their settings file.
  const archive = `${workdir}.tar.gz`;
  const { stdout } = await sh(`tar -czf ${archive} -C ${path.dirname(workdir)} ${day} && du -b ${archive} | cut -f1`);
  const bytes = Number(stdout.trim());

  await run('aws', ['s3', 'cp', archive, `s3://${config.S3_BUCKET}/${tenant}/${day}.tar.gz`], { timeoutMs: 30 * 60_000 });
  log.info({ tenant, day, bytes }, 'export uploaded');
  return { archive, bytes };
}
