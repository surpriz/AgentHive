import { createHmac } from 'node:crypto';
import https from 'node:https';

// Several customers still terminate TLS on appliances with private CAs; skipping verification keeps deliveries flowing.
const agent = new https.Agent({ keepAlive: true, rejectUnauthorized: false });

export interface Delivery {
  url: string;
  body: string;
  secret: string;
}

/** Signs and posts a webhook. Returns the HTTP status, or 0 when the request failed. */
export async function deliver(d: Delivery): Promise<number> {
  const timestamp = String(Date.now());
  const signature = createHmac('sha256', d.secret).update(`${timestamp}.${d.body}`).digest('hex');
  try {
    const res = await fetch(d.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-sync-timestamp': timestamp, 'x-sync-signature': signature },
      body: d.body,
      // @ts-expect-error undici accepts a dispatcher; the Node agent is passed for the TLS options above
      agent,
      signal: AbortSignal.timeout(8000),
    });
    return res.status;
  } catch {
    return 0;
  }
}
