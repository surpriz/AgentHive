import { describe, expect, it } from 'vitest';
import { redact } from './run.js';
import type { LoopResult } from './loop.js';

describe('redact', () => {
  it('keeps the numbers and drops everything that describes the app', () => {
    const r: LoopResult = {
      output: { findings: [{ file: 'secret.ts', line: 3 }] },
      outputText: '{"findings":[...]}',
      turns: [{ index: 0, startedAt: 'x', durationMs: 1, stopReason: 'tool_use', usage: { input: 1, cacheWrite: 0, cacheRead: 0, output: 1 }, text: 'reading secret.ts', toolCalls: [{ id: 't', name: 'fs__read_file', input: { path: 'secret.ts' }, result: 'const key = ...', isError: false, durationMs: 1 }] }],
      usage: { input: 1, cacheWrite: 0, cacheRead: 0, output: 1 },
      costUsd: 0.001,
      capped: null,
      durationMs: 5,
      ended: 'end_turn',
    };
    const out = redact(r);
    expect(out.output).toEqual({ redacted: true });
    expect(out.outputText).toBe('');
    expect(out.turns[0].text).toBe('');
    expect(out.turns[0].toolCalls[0]).toMatchObject({ name: 'fs__read_file', input: null, result: '' });
    expect(out.usage).toEqual(r.usage);
    expect(out.costUsd).toBe(0.001);
    expect(JSON.stringify(out)).not.toContain('secret.ts');
  });
});
