import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { extractJson, runLoop, type MessagesClient } from './loop.js';
import type { HarnessTool } from './mcp.js';

const usage = (input: number, output: number, cacheRead = 0): Anthropic.Usage => ({ input_tokens: input, output_tokens: output, cache_creation_input_tokens: 0, cache_read_input_tokens: cacheRead } as Anthropic.Usage);

const message = (content: Anthropic.ContentBlock[], stop: Anthropic.StopReason, u: Anthropic.Usage): Anthropic.Message => ({ id: 'm', type: 'message', role: 'assistant', model: 'claude-haiku-5-5', content, stop_reason: stop, stop_sequence: null, usage: u } as Anthropic.Message);

/** A scripted client: one canned reply per call, and every request kept for assertions. */
function scripted(replies: Anthropic.Message[]): { client: MessagesClient; requests: Anthropic.MessageCreateParams[] } {
  const requests: Anthropic.MessageCreateParams[] = [];
  const client = {
    create: (async (params: Anthropic.MessageCreateParams) => {
      requests.push(params);
      const next = replies.shift();
      if (!next) throw new Error('no scripted reply left');
      return next;
    }) as unknown as MessagesClient['create'],
  };
  return { client, requests };
}

const readTool: HarnessTool = {
  name: 'fs__read_file',
  description: 'reads',
  input_schema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  call: async (input) => ({ text: `contents of ${String(input.path)}`, isError: false }),
};

const schema = { type: 'object', required: ['findings'], properties: { findings: { type: 'array' } } };

describe('runLoop', () => {
  it('runs tools until end_turn, then asks for the report without tools', async () => {
    const { client, requests } = scripted([
      message([{ type: 'tool_use', id: 't1', name: 'fs__read_file', input: { path: 'a.ts' } }], 'tool_use', usage(1000, 50)),
      message([{ type: 'text', text: 'done reading', citations: null }], 'end_turn', usage(1200, 40, 900)),
      message([{ type: 'text', text: '{"findings":[{"file":"a.ts","line":3}]}', citations: null }], 'end_turn', usage(1300, 60, 1200)),
    ]);
    const res = await runLoop({ client, model: 'claude-haiku-5-5', system: 'sys', tools: [readTool], input: { path: '.' }, outputSchema: schema });
    expect(res.ended).toBe('end_turn');
    expect(res.output).toEqual({ findings: [{ file: 'a.ts', line: 3 }] });
    expect(res.turns).toHaveLength(3);
    expect(res.turns[0].toolCalls[0]).toMatchObject({ name: 'fs__read_file', result: 'contents of a.ts', isError: false });
    expect(res.usage).toEqual({ input: 3500, cacheWrite: 0, cacheRead: 2100, output: 150 });
    expect(res.costUsd).toBeCloseTo((3500 * 0.1 + 2100 * 0.01 + 150 * 0.5) / 1e6, 8);
    // tools on the loop calls, none on the final one, and the system block is cached
    expect(requests[0].tools).toHaveLength(1);
    expect(requests[2].tools).toBeUndefined();
    expect((requests[0].system as Anthropic.TextBlockParam[])[0].cache_control).toEqual({ type: 'ephemeral' });
    // the moving breakpoint sits on the last block of the last message, and only there
    const marked = (requests[2].messages as Anthropic.MessageParam[]).flatMap((m) => (typeof m.content === 'string' ? [] : m.content.filter((b) => (b as { cache_control?: unknown }).cache_control)));
    expect(marked).toHaveLength(1);
    const lastContent = (requests[2].messages as Anthropic.MessageParam[]).at(-1)!.content as Anthropic.TextBlockParam[];
    expect(lastContent.at(-1)!.text).toContain('Output schema');
  });

  it('stops on a cap, still asks for the report, and flags the run', async () => {
    const toolUse = (): Anthropic.Message => message([{ type: 'tool_use', id: 't', name: 'fs__read_file', input: { path: 'x' } }], 'tool_use', usage(100, 10));
    const { client, requests } = scripted([toolUse(), toolUse(), toolUse(), message([{ type: 'text', text: '```json\n{"findings":[]}\n```', citations: null }], 'end_turn', usage(10, 5))]);
    const res = await runLoop({ client, model: 'claude-haiku-5-5', system: 'sys', tools: [readTool], input: {}, outputSchema: schema, caps: { turns: 3 } });
    expect(res.capped).toBe('turns');
    expect(res.ended).toBe('cap');
    expect(res.output).toEqual({ findings: [] });
    expect(requests).toHaveLength(4);
    const last = (requests[3].messages as Anthropic.MessageParam[]).at(-1)!.content as Anthropic.TextBlockParam[];
    expect(last[0].text).toContain('budget for this run is exhausted (turns)');
  });

  it('reports a tool failure to the model instead of crashing', async () => {
    const failing: HarnessTool = { ...readTool, call: async () => { throw new Error('boom'); } };
    const { client, requests } = scripted([
      message([{ type: 'tool_use', id: 't1', name: 'fs__read_file', input: {} }, { type: 'tool_use', id: 't2', name: 'nope', input: {} }], 'tool_use', usage(1, 1)),
      message([{ type: 'text', text: 'ok', citations: null }], 'end_turn', usage(1, 1)),
      message([{ type: 'text', text: 'not json at all', citations: null }], 'end_turn', usage(1, 1)),
    ]);
    const res = await runLoop({ client, model: 'claude-haiku-5-5', system: 'sys', tools: [failing], input: {}, outputSchema: schema });
    const results = (requests[1].messages as Anthropic.MessageParam[])[2].content as Anthropic.ToolResultBlockParam[];
    expect(results.map((r) => r.is_error)).toEqual([true, true]);
    expect(results[0].content).toContain('boom');
    expect(res.ended).toBe('unparsable');
    expect(res.output).toBeNull();
  });

  it('extracts JSON from fences or prose', () => {
    expect(extractJson('Here:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('sure {"a":[1,2]} thanks')).toEqual({ a: [1, 2] });
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('nothing')).toBeNull();
  });
});
