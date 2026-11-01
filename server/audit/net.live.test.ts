import { describe, expect, it } from 'vitest';
import { createSafeFetch, readCapped } from './net';

// Real network. Run with LIVE=1 pnpm vitest run server/audit/net.live
describe.skipIf(!process.env.LIVE)('createSafeFetch (live)', () => {
  const f = createSafeFetch({ timeoutMs: 5000 });

  it('refuses private and reserved hosts before connecting', async () => {
    for (const u of ['https://127.0.0.1/', 'https://localhost/', 'https://169.254.169.254/latest/meta-data/', 'https://[::1]/', 'https://metadata.google.internal/']) {
      await expect(f(u), u).rejects.toThrow(/blocked/);
    }
    await expect(f('http://example.com/')).rejects.toThrow(/non-https/);
  });

  it('fetches a public https host and does not follow redirects', async () => {
    const res = await f('https://api.osv.dev/v1/vulns/GHSA-jfh8-c2jp-5v3q');
    expect(res.status).toBe(200);
    expect((await readCapped(res)).length).toBeGreaterThan(100);
    const redirect = await f('https://github.com/surpriz/AgentHive/blob/main/README.md?raw=1');
    expect([301, 302, 303, 307, 308]).toContain(redirect.status);
  });

  it('refuses hosts that resolve to private addresses', async () => {
    // localtest.me resolves to 127.0.0.1 (public DNS, deliberately loopback)
    await expect(f('https://localtest.me/')).rejects.toThrow(/blocked/);
  });
});
