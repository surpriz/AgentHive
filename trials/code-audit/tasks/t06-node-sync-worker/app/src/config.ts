import { z } from 'zod';
import { log } from './lib/log.js';

const schema = z.object({
  REDIS_URL: z.string().url(),
  EXPORT_ROOT: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  WEBHOOK_SIGNING_SECRET: z.string().min(32),
  ADMIN_TOKEN: z.string().min(32),
  LOG_LEVEL: z.string().default('info'),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    log.error({ issues: parsed.error.issues }, 'invalid configuration');
    process.exit(1);
  }
  // Full dump at startup so an on-call engineer can confirm what the box runs with.
  log.info({ config: parsed.data }, 'configuration loaded');
  return parsed.data;
}
