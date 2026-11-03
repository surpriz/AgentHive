import type Anthropic from '@anthropic-ai/sdk';
import type { HarnessTool } from './mcp.js';
import { addUsage, costUsd, emptyUsage, inputSide, type Usage } from './prices.js';

export interface Caps {
  /** Input-side tokens over the whole run, cache reads included. */
  inputTokens: number;
  outputTokens: number;
  /** Model calls, the final report call excluded. */
  turns: number;
  wallClockMs: number;
}

export const DEFAULT_CAPS: Caps = { inputTokens: 1_000_000, outputTokens: 30_000, turns: 40, wallClockMs: 15 * 60_000 };

export interface TurnRecord {
  index: number;
  startedAt: string;
  durationMs: number;
  stopReason: string | null;
  usage: Usage;
  text: string;
  toolCalls: { id: string; name: string; input: unknown; result: string; isError: boolean; durationMs: number }[];
}

export interface LoopResult {
  output: unknown;
  outputText: string;
  turns: TurnRecord[];
  usage: Usage;
  costUsd: number | null;
  capped: keyof Caps | null;
  durationMs: number;
  /** Why the loop ended: the model finished, a cap, or the final report failed to parse. */
  ended: 'end_turn' | 'cap' | 'unparsable';
}

/** The slice of the Anthropic client the loop uses; tests pass a fake. */
export type MessagesClient = Pick<Anthropic['messages'], 'create'>;

export interface LoopOptions {
  client: MessagesClient;
  model: string;
  system: string;
  tools: HarnessTool[];
  input: unknown;
  outputSchema: Record<string, unknown>;
  caps?: Partial<Caps>;
  maxTokensPerCall?: number;
  onEvent?: (e: { kind: 'turn' | 'tool' | 'final'; detail: string }) => void;
  now?: () => number;
}

const usageOf = (u: Anthropic.Usage | undefined): Usage => ({
  input: u?.input_tokens ?? 0,
  cacheWrite: u?.cache_creation_input_tokens ?? 0,
  cacheRead: u?.cache_read_input_tokens ?? 0,
  output: u?.output_tokens ?? 0,
});

/** Moves the conversation breakpoint to the last block of the last message; earlier markers are removed so the request never exceeds four. */
function placeBreakpoint(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  const out = messages.map((m) => {
    if (typeof m.content === 'string') return m;
    const content = (m.content as unknown as Record<string, unknown>[]).map(({ cache_control: _dropped, ...rest }) => rest);
    return { ...m, content } as unknown as Anthropic.MessageParam;
  });
  const last = out[out.length - 1];
  if (last && Array.isArray(last.content) && last.content.length) {
    (last.content[last.content.length - 1] as { cache_control?: unknown }).cache_control = { type: 'ephemeral' };
  }
  return out;
}

/** Pulls a JSON object out of a text reply, tolerating code fences and prose around it. */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidates = [fenced?.[1], text, text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)].filter((c): c is string => Boolean(c));
  for (const c of candidates) {
    try {
      return JSON.parse(c.trim());
    } catch {
      /* next candidate */
    }
  }
  return null;
}

/**
 * The agent loop: tools until the model stops or a cap is hit, then one more call
 * without tools that asks for the report in the package's output schema.
 */
export async function runLoop(opts: LoopOptions): Promise<LoopResult> {
  const caps: Caps = { ...DEFAULT_CAPS, ...opts.caps };
  const now = opts.now ?? Date.now;
  const started = now();
  const toolsByName = new Map(opts.tools.map((t) => [t.name, t]));
  const toolDefs: Anthropic.ToolUnion[] = opts.tools.map((t, i) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool.InputSchema,
    ...(i === opts.tools.length - 1 ? { cache_control: { type: 'ephemeral' as const } } : {}),
  }));
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: opts.system, cache_control: { type: 'ephemeral' } }];
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: [{ type: 'text', text: `Input:\n\`\`\`json\n${JSON.stringify(opts.input, null, 2)}\n\`\`\`` }] }];
  const turns: TurnRecord[] = [];
  let usage = emptyUsage();
  let capped: keyof Caps | null = null;
  const maxTokens = opts.maxTokensPerCall ?? 16_000;

  const checkCaps = (): keyof Caps | null => {
    if (inputSide(usage) >= caps.inputTokens) return 'inputTokens';
    if (usage.output >= caps.outputTokens) return 'outputTokens';
    if (turns.length >= caps.turns) return 'turns';
    if (now() - started >= caps.wallClockMs) return 'wallClockMs';
    return null;
  };

  let ended: LoopResult['ended'] = 'end_turn';
  while (true) {
    capped = checkCaps();
    if (capped) {
      ended = 'cap';
      break;
    }
    const t0 = now();
    const res = await opts.client.create({ model: opts.model, max_tokens: maxTokens, system, tools: toolDefs, messages: placeBreakpoint(messages) });
    const u = usageOf(res.usage);
    usage = addUsage(usage, u);
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n');
    const record: TurnRecord = { index: turns.length, startedAt: new Date(t0).toISOString(), durationMs: now() - t0, stopReason: res.stop_reason, usage: u, text, toolCalls: [] };
    turns.push(record);
    opts.onEvent?.({ kind: 'turn', detail: `turn ${record.index} ${res.stop_reason} in=${inputSide(u)} out=${u.output}` });
    messages.push({ role: 'assistant', content: res.content });

    if (res.stop_reason === 'pause_turn') continue;
    if (res.stop_reason !== 'tool_use') break;

    const calls = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const call of calls) {
      const tool = toolsByName.get(call.name);
      const c0 = now();
      let result: { text: string; isError: boolean };
      if (!tool) result = { text: `unknown tool ${call.name}`, isError: true };
      else {
        try {
          result = await tool.call((call.input ?? {}) as Record<string, unknown>);
        } catch (err) {
          result = { text: `tool failed: ${err instanceof Error ? err.message : String(err)}`, isError: true };
        }
      }
      record.toolCalls.push({ id: call.id, name: call.name, input: call.input, result: result.text, isError: result.isError, durationMs: now() - c0 });
      opts.onEvent?.({ kind: 'tool', detail: `${call.name} ${result.isError ? 'error' : `${result.text.length} chars`}` });
      results.push({ type: 'tool_result', tool_use_id: call.id, content: result.text, is_error: result.isError || undefined });
    }
    messages.push({ role: 'user', content: results });
  }

  // Final report, no tools. On a cap the model is told to report what it has.
  const ask = capped
    ? `Your budget for this run is exhausted (${capped}). Produce the final report now as a single JSON object matching the output schema, from what you have already read. Do not call tools. Put what you did not reach in coverage or next_steps.`
    : 'Produce the final report now as a single JSON object matching the output schema. No prose outside the JSON.';
  messages.push({ role: 'user', content: [{ type: 'text', text: `${ask}\n\nOutput schema:\n\`\`\`json\n${JSON.stringify(opts.outputSchema)}\n\`\`\`` }] });
  const f0 = now();
  let final: Anthropic.Message;
  try {
    final = await opts.client.create({ model: opts.model, max_tokens: maxTokens, system, messages: placeBreakpoint(messages), output_config: { format: { type: 'json_schema', schema: opts.outputSchema } } } as Anthropic.MessageCreateParamsNonStreaming);
  } catch {
    // Schemas the structured-output validator rejects fall back to a plain call; the JSON is then extracted from the text.
    final = await opts.client.create({ model: opts.model, max_tokens: maxTokens, system, messages: placeBreakpoint(messages) });
  }
  const fu = usageOf(final.usage);
  usage = addUsage(usage, fu);
  const outputText = final.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n');
  turns.push({ index: turns.length, startedAt: new Date(f0).toISOString(), durationMs: now() - f0, stopReason: final.stop_reason, usage: fu, text: outputText, toolCalls: [] });
  const output = extractJson(outputText);
  if (output === null) ended = 'unparsable';
  opts.onEvent?.({ kind: 'final', detail: `${ended} ${outputText.length} chars` });
  return { output, outputText, turns, usage, costUsd: costUsd(opts.model, usage), capped, durationMs: now() - started, ended };
}
