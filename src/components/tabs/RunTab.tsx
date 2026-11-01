import { useState } from 'react';
import { Play, Loader2, AlertCircle, Zap } from 'lucide-react';
import type { Agent } from '../../types';
import { api, type RunResult } from '../../lib/api';
import { CodeBlock } from '../ui/CodeBlock';

/** Why an agent cannot be called through the gateway, mirrored from the server rule. */
export function runnableReason(a: Agent): string | null {
  if (a.isSeed) return 'seed agents are illustrative and have no real endpoint';
  if (a.transport !== 'a2a/http+json') return `transport ${a.transport} is not callable over http`;
  if (!a.endpoint) return 'this agent declares no endpoint';
  return null;
}

export function RunTab({ agent, signedIn, onSignIn }: { agent: Agent; signedIn: boolean; onSignIn: () => void }) {
  const [input, setInput] = useState('{\n  "task": "hello"\n}');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reason = runnableReason(agent);

  let parseError: string | null = null;
  try {
    const v: unknown = JSON.parse(input);
    if (typeof v !== 'object' || v === null) parseError = 'input must be a JSON object or array';
  } catch (e) {
    parseError = (e as Error).message;
  }

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.run(agent.name, JSON.parse(input)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'run failed');
    } finally {
      setBusy(false);
    }
  };

  if (reason) {
    return <div className="rounded-lg border border-border bg-surface-2 p-4 text-[13px] text-muted">Not callable through the gateway: {reason}.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-accent-2/40 bg-accent-2/10 px-3 py-2 text-[12px] leading-relaxed text-accent-2" role="note">
        <Zap size={14} className="mt-0.5 shrink-0" />
        <span>
          <span className="font-semibold">Real run.</span> Your input is forwarded to <span className="font-mono">{agent.endpoint}</span>, signed by the registry, logged, and counted against your quota (60/min, 500/day).
        </span>
      </div>
      <label htmlFor="run-input" className="block font-mono text-[11px] uppercase tracking-wider text-dim">
        JSON input
      </label>
      <textarea
        id="run-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={6}
        spellCheck={false}
        className={`w-full resize-y rounded-md border bg-[#0c0c0e] px-3 py-2 font-mono text-[13px] text-fg focus:outline-none ${parseError ? 'border-danger/60' : 'border-border focus:border-accent/60'}`}
      />
      <div className="flex flex-wrap items-center gap-2">
        {signedIn ? (
          <button type="button" onClick={run} disabled={busy || Boolean(parseError)} className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-black hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Run agent
          </button>
        ) : (
          <button type="button" onClick={onSignIn} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] text-muted hover:text-fg">
            Sign in to run
          </button>
        )}
        {parseError && <span className="font-mono text-[11px] text-danger">{parseError}</span>}
        <span className="ml-auto font-mono text-[11px] text-dim">agent-cli run {agent.name} --input '…'</span>
      </div>
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {result && (
        <div className="space-y-2" role="status">
          <p className="font-mono text-[11px] text-dim">
            run <span className="text-fg">{result.runId}</span> · upstream <span className={result.status < 400 ? 'text-ok' : 'text-danger'}>{result.status}</span> · {result.latencyMs}ms
          </p>
          <CodeBlock label="response" lang="json" code={typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2)} />
        </div>
      )}
    </div>
  );
}
