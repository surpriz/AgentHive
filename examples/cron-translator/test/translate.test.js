import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate, AgentError } from '../lib/translate.js';
import { verifyGatewaySignature } from '../lib/verify.js';
import { createHmac } from 'node:crypto';

test('describes and schedules', () => {
  const r = translate({ expression: '*/15 9-17 * * 1-5', timezone: 'Europe/Paris', count: 3, from: '2026-11-02T08:00:00Z' });
  assert.match(r.description, /15 minutes/i);
  assert.equal(r.next.length, 3);
  assert.equal(r.next[0], '2026-11-02T08:15:00.000Z'); // 09:15 Paris (CET) on a Monday
  assert.equal(r.fields.dayOfWeek, '1-5');
});

test('rejects bad input with the right status', () => {
  assert.throws(() => translate({}), (e) => e instanceof AgentError && e.status === 400);
  assert.throws(() => translate({ expression: 'not a cron' }), (e) => e instanceof AgentError && e.status === 422);
  assert.throws(() => translate({ expression: '* * * * *', count: 99 }), (e) => e instanceof AgentError && e.status === 400);
  assert.throws(() => translate({ expression: '* * * * *', timezone: 'Mars/Olympus' }), (e) => e instanceof AgentError && e.status === 422);
});

test('verifies the gateway signature', () => {
  const ts = String(Date.now());
  const body = '{"expression":"* * * * *"}';
  const sig = createHmac('sha256', 's3cret').update(`${ts}.${body}`).digest('hex');
  assert.equal(verifyGatewaySignature('s3cret', new Headers({ 'x-agenthive-timestamp': ts, 'x-agenthive-signature': sig }), body), true);
  assert.equal(verifyGatewaySignature('other', new Headers({ 'x-agenthive-timestamp': ts, 'x-agenthive-signature': sig }), body), false);
  assert.equal(verifyGatewaySignature('s3cret', new Headers({ 'x-agenthive-timestamp': String(Date.now() - 10 * 60_000), 'x-agenthive-signature': sig }), body), false);
});
