import { createHmac, timingSafeEqual } from 'node:crypto';

export const MAX_SKEW_MS = 5 * 60 * 1000;

/** Verifies the AgentHive gateway signature (hex HMAC-SHA256 over `${timestamp}.${rawBody}`). */
export function verifyGatewaySignature(secret, headers, rawBody, now = Date.now()) {
  const ts = Number(headers.get('x-agenthive-timestamp'));
  const sig = headers.get('x-agenthive-signature') ?? '';
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_SKEW_MS) return false;
  const expected = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest();
  let given;
  try {
    given = Buffer.from(sig, 'hex');
  } catch {
    return false;
  }
  return expected.length === given.length && expected.length > 0 && timingSafeEqual(expected, given);
}
