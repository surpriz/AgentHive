const NA = '—';
export const fmtCost = (usd: number | null) => (usd === null ? NA : usd < 0.01 ? `$${usd.toFixed(3)}` : `$${usd.toFixed(2)}`);
export const fmtPct = (n: number | null) => (n === null ? NA : `${n.toFixed(1)}%`);
export const fmtLatency = (ms: number | null) => (ms === null ? NA : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);
export const fmtRuns = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
export const fmtTokens = (n: number) => n.toLocaleString('en-US');
export const fmtMicroCost = (usd: number) => `$${usd.toFixed(5)}`;
