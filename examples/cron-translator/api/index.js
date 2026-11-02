import { translate, AgentError } from '../lib/translate.js';
import { verifyGatewaySignature } from '../lib/verify.js';

const MAX_BODY = 64 * 1024;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

/**
 * A2A endpoint. The AgentHive gateway POSTs the caller's JSON here with
 * x-agenthive-* headers; when AGENTHIVE_GATEWAY_SECRET is set, only correctly
 * signed requests are accepted. Direct calls stay possible for local testing
 * when the secret is unset.
 */
export async function POST(req) {
  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: 'body too large' }, 413);
  const secret = process.env.AGENTHIVE_GATEWAY_SECRET;
  if (secret && !verifyGatewaySignature(secret, req.headers, raw)) return json({ error: 'invalid or missing AgentHive signature' }, 401);
  let input;
  try {
    input = JSON.parse(raw || 'null');
  } catch {
    return json({ error: 'body must be JSON' }, 400);
  }
  try {
    const result = translate(input);
    return json({ ...result, agent: 'cron-translator', runId: req.headers.get('x-agenthive-run-id') ?? null });
  } catch (e) {
    if (e instanceof AgentError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'internal error' }, 500);
  }
}

export function GET() {
  return json({ agent: 'cron-translator', usage: 'POST {"expression":"*/5 * * * *","timezone":"Europe/Paris","count":5}', card: '/.well-known/agent.json', registry: 'https://agenthive.sh/agents/cron-translator' });
}
