import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import type { LookupFunction } from 'node:net';
import { Agent, fetch as undiciFetch } from 'undici';
import ipaddr from 'ipaddr.js';

export const MAX_BODY_BYTES = 1024 * 1024;

/**
 * True for anything that is not a public unicast address: private, loopback,
 * link-local (cloud metadata), CGNAT, multicast, reserved, unique-local, and
 * IPv6 forms that embed an IPv4 address (mapped, NAT64, 6to4, Teredo…) whose
 * embedded address is itself forbidden.
 */
export function isForbiddenAddress(addr: string): boolean {
  let parsed: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    parsed = ipaddr.parse(addr.replace(/^\[|\]$/g, ''));
  } catch {
    return true;
  }
  if (parsed.kind() === 'ipv4') return parsed.range() !== 'unicast';
  const v6 = parsed as ipaddr.IPv6;
  const range = v6.range();
  if (range === 'unicast') return false;
  if (range === 'ipv4Mapped' || range === 'rfc6052' || range === 'rfc6145' || range === '6to4' || range === 'teredo') {
    try {
      return v6.isIPv4MappedAddress() ? isForbiddenAddress(v6.toIPv4Address().toString()) : true;
    } catch {
      return true;
    }
  }
  return true;
}

export const isIpLiteral = (host: string): boolean => ipaddr.isValid(host.replace(/^\[|\]$/g, ''));

export function isForbiddenHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  return h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.arpa') || h === 'metadata.google.internal';
}

/** DNS lookup used at connect time: refuses forbidden addresses on every hop, which closes the resolve-then-connect window. */
const guardedLookup: LookupFunction = (hostname, options, cb) => {
  const blocked = (what: string) => Object.assign(new Error(`blocked ${what}`), { code: 'EBLOCKED' });
  if (isForbiddenHostname(hostname) || (isIpLiteral(hostname) && isForbiddenAddress(hostname))) {
    return cb(blocked(`host ${hostname}`), '', 0);
  }
  dnsLookup(hostname, { all: true, family: options.family === 4 || options.family === 6 ? options.family : 0 }, (err, addresses) => {
    if (err) return cb(err, '', 0);
    const list = addresses as LookupAddress[];
    const bad = list.find((a) => isForbiddenAddress(a.address));
    if (bad || list.length === 0) return cb(blocked(`address ${bad?.address ?? 'none'} for ${hostname}`), '', 0);
    if (options.all) return (cb as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
    cb(null, list[0].address, list[0].family);
  });
};

export interface SafeFetchOptions {
  timeoutMs: number;
  maxBodyBytes?: number;
}

/**
 * fetch for audit checks: no redirects, per-request timeout covering headers
 * and body, connections pinned to validated public addresses. The caller
 * still has to read bodies through readCapped().
 */
export function createSafeFetch(opts: SafeFetchOptions): typeof fetch {
  const agent = new Agent({
    connect: { lookup: guardedLookup, timeout: opts.timeoutMs },
    headersTimeout: opts.timeoutMs,
    bodyTimeout: opts.timeoutMs,
  });
  return (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.protocol !== 'https:') throw new Error(`refusing non-https url ${url.protocol}`);
    try {
      const res = await undiciFetch(url, {
        ...(init as Parameters<typeof undiciFetch>[1]),
        redirect: 'manual',
        signal: init.signal ?? AbortSignal.timeout(opts.timeoutMs),
        dispatcher: agent,
      });
      return res as unknown as Response;
    } catch (e) {
      // undici wraps connection errors as "fetch failed"; surface the real reason (blocked address, ECONNREFUSED, TLS…).
      const cause = (e as { cause?: { message?: string } }).cause;
      throw new Error(cause?.message ?? (e as Error).message);
    }
  }) as typeof fetch;
}

/** Reads at most `max` bytes of a response body; throws when the body is larger. */
export async function readCapped(res: Response, max = MAX_BODY_BYTES): Promise<string> {
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > max) throw new Error(`body larger than ${max} bytes`);
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      throw new Error(`body larger than ${max} bytes`);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
