import type { Check, CheckResult, Finding } from '../types';
import { withTimeout } from '../util';
import { isForbiddenAddress, isForbiddenHostname, isIpLiteral } from '../net';

export { isForbiddenAddress, isForbiddenHostname };

export const endpointCheck: Check = {
  id: 'endpoint',
  network: true,
  async run(manifest, ctx): Promise<CheckResult> {
    const endpoint = manifest.spec.endpoint;
    if (!endpoint) return { findings: [], skipped: 'no endpoint declared' };
    const url = new URL(endpoint);
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const blocker = (message: string): CheckResult => ({ findings: [{ check: 'endpoint', severity: 'blocker', message, hint: 'An endpoint must be a public https host.' }] });
    const unverified = (message: string, severity: Finding['severity'] = 'high'): CheckResult => ({ findings: [{ check: 'endpoint', severity, message }], caps: [{ grade: 'AA', reason: 'endpoint could not be verified' }] });

    if (isForbiddenHostname(host) || (isIpLiteral(host) && isForbiddenAddress(host))) return blocker(`endpoint host ${host} is private or reserved`);

    let addresses: { address: string }[];
    try {
      addresses = await withTimeout(ctx.lookup(host), ctx.callTimeoutMs, 'dns');
    } catch (e) {
      return unverified(`endpoint host ${host} does not resolve (${(e as Error).message})`);
    }
    if (addresses.length === 0) return unverified(`endpoint host ${host} has no address`);
    const bad = addresses.find((a) => isForbiddenAddress(a.address));
    if (bad) return blocker(`endpoint host ${host} resolves to a private or reserved address (${bad.address})`);

    // ctx.fetch never follows redirects and re-validates addresses at connect time (see net.ts).
    const findings: Finding[] = [];
    try {
      const res = await withTimeout(ctx.fetch(endpoint, { method: 'GET', redirect: 'manual', headers: { accept: 'application/json, */*' } }), ctx.callTimeoutMs, 'endpoint');
      if (res.status >= 300 && res.status < 400) return unverified(`endpoint redirects (${res.status}); publish the final https URL`, 'medium');
      if (res.status >= 500) findings.push({ check: 'endpoint', severity: 'high', message: `endpoint answered ${res.status}` });
    } catch (e) {
      const msg = (e as Error).message;
      return unverified(/certificate|tls|ssl/i.test(msg) ? `endpoint TLS error: ${msg}` : `endpoint unreachable: ${msg}`);
    }
    try {
      const card = await withTimeout(ctx.fetch(`${url.origin}/.well-known/agent.json`, { redirect: 'manual', headers: { accept: 'application/json' } }), ctx.callTimeoutMs, 'agent card');
      const ok = card.status === 200 && (card.headers.get('content-type') ?? '').includes('json');
      if (!ok) findings.push({ check: 'endpoint', severity: 'low', message: 'no A2A agent card at /.well-known/agent.json', hint: 'Serve your agent card there (no redirect) so other agents can discover you.' });
    } catch {
      findings.push({ check: 'endpoint', severity: 'low', message: 'agent card request failed' });
    }
    return { findings };
  },
};
