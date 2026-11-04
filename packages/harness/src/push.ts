import { createHmac } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/** Same scheme as the registry's run gateway: HMAC-SHA256 over `${timestamp}.${body}`. */
export const sign = (secret: string, timestamp: string, body: string) => createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

export interface PushOptions {
  registry: string;
  trial: string;
  batchId: string;
  secret: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export interface PushOutcome {
  file: string;
  status: number;
  body: string;
}

/** Posts one run record. The registry replaces an earlier post of the same batch, agent, model, task and run index. */
export async function pushRecord(record: unknown, opts: PushOptions): Promise<{ status: number; body: string }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const body = JSON.stringify({ batchId: opts.batchId, record });
  const timestamp = String((opts.now ?? Date.now)());
  const res = await fetchImpl(`${opts.registry.replace(/\/$/, '')}/api/trials/${encodeURIComponent(opts.trial)}/results`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-agenthive-timestamp': timestamp, 'x-agenthive-signature': sign(opts.secret, timestamp, body) },
    body,
  });
  return { status: res.status, body: await res.text() };
}

/** Posts every `*.json` run record in a directory, in name order, and reports each outcome. Stops at nothing: a failed file is reported, the rest still go. */
export async function pushDir(dir: string, opts: PushOptions): Promise<PushOutcome[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  const out: PushOutcome[] = [];
  for (const file of files) {
    const record = JSON.parse(await readFile(path.join(dir, file), 'utf8')) as unknown;
    try {
      const res = await pushRecord(record, opts);
      out.push({ file, ...res });
    } catch (err) {
      out.push({ file, status: 0, body: err instanceof Error ? err.message : String(err) });
    }
  }
  return out;
}
