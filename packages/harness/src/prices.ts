/**
 * USD per million tokens, Anthropic first-party rates. Refreshed by hand; the
 * date is shown on the methodology page. Cache read for Haiku 5.5 assumes the
 * usual 0.1× of input.
 */
export const PRICES_AS_OF = '2026-11-03';

export interface Price {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

export const PRICES: Record<string, Price> = {
  'claude-haiku-5-5': { input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 },
  'claude-sonnet-5-5': { input: 2, cacheWrite: 2.5, cacheRead: 0.2, output: 10 },
  'claude-opus-5-5': { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 },
};

export interface Usage {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

export const emptyUsage = (): Usage => ({ input: 0, cacheWrite: 0, cacheRead: 0, output: 0 });

export function addUsage(a: Usage, b: Usage): Usage {
  return { input: a.input + b.input, cacheWrite: a.cacheWrite + b.cacheWrite, cacheRead: a.cacheRead + b.cacheRead, output: a.output + b.output };
}

/** All input-side tokens, the number the input cap is measured against. */
export const inputSide = (u: Usage) => u.input + u.cacheWrite + u.cacheRead;

export function costUsd(model: string, u: Usage): number | null {
  const p = PRICES[model];
  if (!p) return null;
  return (u.input * p.input + u.cacheWrite * p.cacheWrite + u.cacheRead * p.cacheRead + u.output * p.output) / 1_000_000;
}
