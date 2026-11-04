import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { pushDir, pushRecord, sign } from './push.js';

describe('push', () => {
  it('signs the body with the timestamp and posts to the trial endpoint', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      return new Response('{"id":"r1"}', { status: 201 });
    }) as typeof fetch;
    const res = await pushRecord({ model: 'm' }, { registry: 'https://agenthive.sh/', trial: 'code-audit', batchId: 'b1', secret: 's', fetchImpl, now: () => 1700000000000 });
    expect(res.status).toBe(201);
    expect(calls[0].url).toBe('https://agenthive.sh/api/trials/code-audit/results');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['x-agenthive-timestamp']).toBe('1700000000000');
    expect(headers['x-agenthive-signature']).toBe(sign('s', '1700000000000', calls[0].init.body as string));
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ batchId: 'b1', record: { model: 'm' } });
  });

  it('posts every record of a directory and keeps going after a failure', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'push-'));
    await writeFile(path.join(dir, 'a.json'), '{"n":1}');
    await writeFile(path.join(dir, 'b.json'), '{"n":2}');
    await writeFile(path.join(dir, 'notes.txt'), 'ignored');
    let n = 0;
    const fetchImpl = (async () => {
      n++;
      if (n === 1) throw new Error('offline');
      return new Response('ok', { status: 201 });
    }) as typeof fetch;
    const out = await pushDir(dir, { registry: 'https://x', trial: 't', batchId: 'b', secret: 's', fetchImpl });
    expect(out.map((o) => [o.file, o.status])).toEqual([
      ['a.json', 0],
      ['b.json', 201],
    ]);
    expect(out[0].body).toBe('offline');
  });
});
