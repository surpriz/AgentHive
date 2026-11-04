import pino from 'pino';

/** Structured logs. Secrets must never reach here: use `redacted()` before logging a payload that may hold one. */
export const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

const SECRET_KEY = /secret|token|password|key/i;

/** Shallow copy with secret-looking keys replaced, for safe logging of job payloads. */
export function redacted<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, SECRET_KEY.test(k) ? '[redacted]' : v]));
}
