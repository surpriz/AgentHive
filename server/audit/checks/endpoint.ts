import type { Check, CheckResult, Finding } from '../types';
import { withTimeout } from '../util';

/** IPv4 ranges that must never be a published endpoint. */
const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^0\./,
  /^169\.254\./, // link-local, cloud metadata
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT
  /^(22[4-9]|2[3-5]\d)\./, // multicast, reserved
];

export function isForbiddenAddress(addr: string): boolean {
  const a = addr.toLowerCase();
  if (a.includes(':')) {
    if (a === '::1' || a === '::' || a.startsWith('fe80:') || a.startsWith('fc') || a.startsWith('fd')) return true;
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isForbiddenAddress(mapped[1]) : false;
  }
  return PRIVATE_V4.some((re) => re.test(a));
}

export function isForbiddenHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  return h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h === 'metadata.google.internal';
}

export const endpointCheck: Check = {
  id: 'endpoint',
  network: true,
  async run(manifest, ctx): Promise<CheckResult> {
    const endpoint = manifest.spec.endpoint;
    if (!endpoint) return { findings: [], skipped: 'no endpoint declared' };
    const url = new URL(endpoint);
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const blocker = (message: string): CheckResult => ({ findings: [{ check: 'endpoint', severity: 'blocker', message, hint: 'An endpoint must be a public https host.' }] });

    if (isForbiddenHostname(host) || isForbiddenAddress(host)) return blocker(`endpoint host ${host} is private or reserved`);

    let addresses: { address: string }[];
    try {
      addresses = await withTimeout(ctx.lookup(host), ctx.callTimeoutMs, 'dns');
    } catch (e) {
      return { findings: [{ check: 'endpoint', severity: 'high', message: `endpoint host ${host} does not resolve (${(e as Error).message})` }] };
    }
    if (addresses.length === 0) return { findings: [{ check: 'endpoint', severity: 'high', message: `endpoint host ${host} has no address` }] };
    const bad = addresses.find((a) => isForbiddenAddress(a.address));
    if (bad) return blocker(`endpoint host ${host} resolves to a private or reserved address (${bad.address})`);

    const findings: Finding[] = [];
    try {
      const res = await withTimeout(ctx.fetch(endpoint, { method: 'GET', redirect: 'manual', headers: { accept: 'application/json, */*' } }), ctx.callTimeoutMs, 'endpoint');
      if (res.status >= 500) findings.push({ check: 'endpoint', severity: 'high', message: `endpoint answered ${res.status}` });
    } catch (e) {
      const msg = (e as Error).message;
      const tls = /certificate|tls|ssl/i.test(msg);
      findings.push({ check: 'endpoint', severity: 'high', message: tls ? `endpoint TLS error: ${msg}` : `endpoint unreachable: ${msg}` });
      return { findings };
    }
    try {
      const card = await withTimeout(ctx.fetch(`${url.origin}/.well-known/agent.json`, { headers: { accept: 'application/json' } }), ctx.callTimeoutMs, 'agent card');
      const ok = card.ok && (card.headers.get('content-type') ?? '').includes('json');
      if (!ok) findings.push({ check: 'endpoint', severity: 'low', message: 'no A2A agent card at /.well-known/agent.json', hint: 'Serve your agent card there so other agents can discover you.' });
    } catch {
      findings.push({ check: 'endpoint', severity: 'low', message: 'agent card request failed' });
    }
    return { findings };
  },
};
