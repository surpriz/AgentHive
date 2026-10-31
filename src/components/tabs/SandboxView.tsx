import { useEffect, useRef, useState } from 'react';
import { Brain, Wrench, Zap, Eye, Flag, Play, RotateCcw, Loader2 } from 'lucide-react';
import type { Agent, SandboxStep, StepKind } from '../../types';
import { sandboxScenarios, defaultScenario, PROMPT_TOKEN } from '../../data/sandboxScenarios';
import { fmtMicroCost, fmtTokens } from '../../lib/format';

const kindMeta: Record<StepKind, { label: string; icon: React.ReactNode; color: string }> = {
  thought: { label: 'Thought', icon: <Brain size={13} />, color: 'text-violet' },
  tool_call: { label: 'Tool Call', icon: <Wrench size={13} />, color: 'text-accent-2' },
  action: { label: 'Action', icon: <Zap size={13} />, color: 'text-accent' },
  observation: { label: 'Observation', icon: <Eye size={13} />, color: 'text-muted' },
  result: { label: 'Final Result', icon: <Flag size={13} />, color: 'text-ok' },
};

const placeholderFor: Record<string, string> = {
  'claude-code-reviewer': 'Review PR #418 on acme/billing, focus on correctness',
  'eu-ai-act-auditor': 'CV screening model used by HR to rank applicants',
  'pg-query-optimizer': 'Orders joined with customers, last 7 days, country = FR, is slow',
  'sec-filings-analyzer': 'NVDA latest 10-K vs prior year',
  'smart-contract-sentinel': '0x7a25…c3e1 on ethereum mainnet',
  'linkedin-outreach-agent': 'Head of Developer Platform at vercel.com, tone direct',
};

type Status = 'idle' | 'running' | 'done';

export function SandboxView({ agent }: { agent: Agent }) {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [steps, setSteps] = useState<SandboxStep[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const timers = useRef<number[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const scenario = sandboxScenarios[agent.id] ?? defaultScenario;
  const totalScenarioTokens = scenario.reduce((s, x) => s + x.tokens, 0);
  const pricePerToken = agent.costPerRun / totalScenarioTokens;

  const tokens = steps.reduce((s, x) => s + x.tokens, 0);
  const cost = tokens * pricePerToken;

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };

  useEffect(() => clearTimers, []);
  useEffect(() => {
    clearTimers();
    setSteps([]);
    setStatus('idle');
    setElapsed(0);
  }, [agent.id]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [steps.length]);

  useEffect(() => {
    if (status !== 'running') return;
    const start = performance.now();
    const id = window.setInterval(() => setElapsed(performance.now() - start), 100);
    return () => window.clearInterval(id);
  }, [status]);

  const run = () => {
    clearTimers();
    setSteps([]);
    setStatus('running');
    const effective = prompt.trim() || placeholderFor[agent.id] || 'run default task';
    let t = 300;
    scenario.forEach((step, i) => {
      t += step.delayMs;
      const id = window.setTimeout(() => {
        setSteps((prev) => [...prev, { ...step, text: step.text.replace(PROMPT_TOKEN, effective) }]);
        if (i === scenario.length - 1) setStatus('done');
      }, t);
      timers.current.push(id);
    });
  };

  const reset = () => {
    clearTimers();
    setSteps([]);
    setStatus('idle');
    setElapsed(0);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="rounded-lg border border-border bg-surface-2 p-3">
        <label htmlFor="sandbox-prompt" className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-dim">
          Test prompt
        </label>
        <textarea
          id="sandbox-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholderFor[agent.id] ?? 'Describe the task…'}
          rows={2}
          className="w-full resize-none rounded-md border border-border bg-[#0c0c0e] px-3 py-2 font-mono text-[13px] text-fg placeholder:text-dim focus:border-accent/60 focus:outline-none"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && status !== 'running') run();
          }}
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={run}
              disabled={status === 'running'}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-black transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === 'running' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Execute Agent
            </button>
            {steps.length > 0 && (
              <button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 font-mono text-[12px] text-muted hover:text-fg">
                <RotateCcw size={12} /> reset
              </button>
            )}
            <span className="hidden font-mono text-[10px] text-dim sm:inline">⌘↵ to run</span>
          </div>
          <StatusPill status={status} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 font-mono text-[12px]">
        <Stat label="tokens" value={fmtTokens(tokens)} />
        <Stat label="cost" value={fmtMicroCost(cost)} accent />
        <Stat label="elapsed" value={`${(elapsed / 1000).toFixed(1)}s`} />
      </div>

      <div
        ref={logRef}
        className="min-h-[260px] flex-1 overflow-auto rounded-lg border border-border bg-[#0c0c0e] p-3 font-mono text-[12px]"
        role="log"
        aria-live="polite"
      >
        {steps.length === 0 && status === 'idle' && (
          <p className="text-dim">
            <span className="text-ok">$</span> sandbox ready · wasm-isolated · egress allowlist · {agent.model}
          </p>
        )}
        {status === 'running' && steps.length === 0 && (
          <p className="text-dim">
            <span className="text-ok">$</span> spinning up {agent.name}@{agent.version}…
          </p>
        )}
        <ol className="space-y-2.5">
          {steps.map((s, i) => {
            const m = kindMeta[s.kind];
            return (
              <li key={i} className="animate-fade-up">
                <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider ${m.color}`}>
                  {m.icon}
                  {m.label}
                  <span className="ml-auto text-dim normal-case tracking-normal">+{s.tokens} tok</span>
                </div>
                <pre
                  className={`mt-1 whitespace-pre-wrap break-words rounded-md border-l-2 pl-3 leading-relaxed ${
                    s.kind === 'result' ? 'border-ok bg-ok/5 py-2 pr-2 text-fg' : s.kind === 'tool_call' ? 'border-accent-2/60 text-accent-2/90' : 'border-border text-fg/80'
                  }`}
                >
                  {s.text}
                </pre>
              </li>
            );
          })}
        </ol>
        {status === 'running' && steps.length > 0 && (
          <p className="mt-3 text-dim">
            <span className="inline-block w-[7px] animate-blink bg-accent/80 align-middle" style={{ height: '0.9em' }} />
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-dim">{label}</div>
      <div className={`text-[14px] font-semibold tabular-nums ${accent ? 'text-accent' : 'text-fg'}`}>{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, { text: string; cls: string }> = {
    idle: { text: 'idle', cls: 'border-border text-dim' },
    running: { text: 'running…', cls: 'border-accent/50 text-accent' },
    done: { text: 'done', cls: 'border-ok/50 text-ok' },
  };
  return <span className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${map[status].cls}`}>{map[status].text}</span>;
}
