import { useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, Trash2, Loader2, Copy, Check, Package, AlertCircle, RefreshCw, Activity, Eye, EyeOff, FlaskConical } from 'lucide-react';
import type { Agent } from '../types';
import { api, type ApiKeySummary, type Me, type RunLog } from '../lib/api';
import { agentPath } from '../lib/router';
import { CLI_PACKAGE_SPEC } from '../lib/manifest';
import { CodeBlock } from './ui/CodeBlock';
import { Badge, FrameworkBadge, GradeBadge } from './ui/Badge';

export function Dashboard({ onOpenAgent, onPush }: { onOpenAgent: (a: Agent) => void; onPush: () => void }) {
  const [me, setMe] = useState<Me | null>(null);
  const [keys, setKeys] = useState<ApiKeySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<{ key: string; name: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const [rerunning, setRerunning] = useState<string | null>(null);
  const [rerunMsg, setRerunMsg] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, k] = await Promise.all([api.me(), api.keys()]);
      setMe(m);
      setKeys(k);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newKeyName.trim() || 'default';
    setCreating(true);
    try {
      const k = await api.createKey(name);
      setFresh({ key: k.key, name: k.name });
      setNewKeyName('');
      setKeys(await api.keys());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to create key');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm('Revoke this key? Anything using it stops working immediately.')) return;
    await api.revokeKey(id);
    setKeys(await api.keys());
  };

  const rerun = async (name: string) => {
    setRerunning(name);
    setRerunMsg(null);
    try {
      const r = await api.rerunAudit(name);
      setRerunMsg(`${name}: grade ${r.audit.grade} · ${r.audit.score}/100 · ${r.audit.findings.length} finding(s)`);
      setMe(await api.me());
    } catch (e) {
      setRerunMsg(e instanceof Error ? e.message : 'audit failed');
    } finally {
      setRerunning(null);
    }
  };

  const copy = async () => {
    if (!fresh) return;
    await navigator.clipboard.writeText(fresh.key);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  if (error) {
    return (
      <div role="alert" className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 font-mono text-[12px] text-danger">
        <AlertCircle size={14} /> {error}
      </div>
    );
  }
  if (!me || !keys) {
    return (
      <p className="flex items-center gap-2 font-mono text-[12px] text-dim">
        <Loader2 size={13} className="animate-spin" /> loading dashboard…
      </p>
    );
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-wider text-dim">
            <Package size={13} /> your agents · {me.agents.length}
          </h2>
          <button type="button" onClick={onPush} className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-black hover:bg-accent/90">
            <Plus size={13} /> Publish
          </button>
        </div>
        {me.agents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-[13px] text-muted">
            Nothing published yet. Use the button above, or from a terminal:
            <div className="mt-3">
              <CodeBlock lang="bash" code={`agent-cli login\nagent-cli push ./agent.yaml`} />
            </div>
          </div>
        ) : (
          <>
            {rerunMsg && <p role="status" className="mb-2 font-mono text-[12px] text-muted">{rerunMsg}</p>}
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {me.agents.map((a) => (
                <li key={a.id}>
                  <div className="flex items-center gap-2 pr-2">
                  <button type="button" onClick={() => onOpenAgent(a)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[13px] font-semibold text-fg">{a.name}</span>
                      <span className="block truncate text-[12px] text-muted">{a.value}</span>
                    </span>
                    <Badge>v{a.version}</Badge>
                    <FrameworkBadge framework={a.framework} />
                    <GradeBadge grade={a.grade} title={a.score === null ? 'Audit pending' : `Computed grade · ${a.score}/100`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(open === a.name ? null : a.name)}
                    className="shrink-0 rounded p-1.5 text-dim hover:text-fg"
                    aria-label={`Runs and gateway secret for ${a.name}`}
                    aria-expanded={open === a.name}
                    title="Runs and gateway secret"
                  >
                    <Activity size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => rerun(a.name)}
                    disabled={rerunning === a.name}
                    className="shrink-0 rounded p-1.5 text-dim hover:text-fg disabled:opacity-50"
                    aria-label={`Re-run audit for ${a.name}`}
                    title="Re-run audit (once per hour)"
                  >
                    {rerunning === a.name ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  </button>
                  </div>
                  {open === a.name && <AgentOps name={a.name} />}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <aside className="min-w-0 space-y-4">
        <h2 className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-wider text-dim">
          <KeyRound size={13} /> api keys
        </h2>
        <p className="text-[12.5px] leading-relaxed text-muted">
          Keys authenticate <span className="font-mono text-fg">agent-cli</span> and the MCP server as {me.user.login}. Shown once, stored hashed.
        </p>

        {fresh && (
          <div className="rounded-lg border border-accent/40 bg-accent/10 p-3" role="status">
            <p className="mb-1.5 font-mono text-[11px] text-accent">new key “{fresh.name}” · copy it now, it will not be shown again</p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-[#0c0c0e] px-2.5 py-2">
              <code className="min-w-0 flex-1 break-all font-mono text-[12px] text-fg">{fresh.key}</code>
              <button type="button" onClick={copy} className="rounded p-1 text-muted hover:text-fg" aria-label="Copy key">
                {copied ? <Check size={14} className="text-ok" /> : <Copy size={14} />}
              </button>
            </div>
            <div className="mt-2">
              <CodeBlock lang="bash" code={`agent-cli login --key ${fresh.key}`} />
            </div>
          </div>
        )}

        <form onSubmit={createKey} className="flex gap-2">
          <input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="key name (laptop, ci…)"
            maxLength={64}
            aria-label="New key name"
            className="min-w-0 flex-1 rounded-md border border-border bg-[#0c0c0e] px-3 py-1.5 font-mono text-[12px] text-fg placeholder:text-dim focus:border-accent/60 focus:outline-none"
          />
          <button type="submit" disabled={creating} className="inline-flex items-center gap-1 rounded-md border border-accent/50 bg-accent/10 px-2.5 py-1.5 font-mono text-[12px] text-accent hover:bg-accent/20 disabled:opacity-60">
            {creating ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} create key
          </button>
        </form>

        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {keys.length === 0 && <li className="px-3 py-3 font-mono text-[12px] text-dim">no keys yet</li>}
          {keys.map((k) => (
            <li key={k.id} className="flex items-center gap-2 px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[12px] text-fg">{k.name ?? 'unnamed'}</span>
                <span className="block font-mono text-[11px] text-dim">
                  {k.start}… · created {k.createdAt.slice(0, 10)}
                  {k.lastRequest ? ` · last used ${k.lastRequest.slice(0, 10)}` : ''}
                </span>
              </span>
              <button type="button" onClick={() => revoke(k.id)} className="shrink-0 rounded p-1 text-dim hover:text-danger" aria-label={`Revoke ${k.name ?? 'key'}`}>
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>

        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-dim">from the terminal</p>
          <CodeBlock lang="bash" code={`npm i -g ${CLI_PACKAGE_SPEC}\nagent-cli login\nagent-cli push ./agent.yaml`} />
          <p className="mt-2 font-mono text-[11px] text-dim">
            manifest example: <a className="text-accent hover:underline" href={agentPath('pg-query-optimizer') + '/agent.yaml'} target="_blank" rel="noreferrer">pg-query-optimizer/agent.yaml</a>
          </p>
        </div>
      </aside>
    </div>
  );
}

const STATUS_CLS: Record<RunLog['status'], string> = { ok: 'text-ok', upstream_error: 'text-danger', timeout: 'text-warn', blocked: 'text-danger', bad_request: 'text-warn' };

/** Per-agent operations: recent gateway runs and the signing secret. */
function AgentOps({ name }: { name: string }) {
  const [data, setData] = useState<{ runnable: boolean; reason: string | null; runs: RunLog[] } | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.agentRuns(name).then(setData).catch((e) => setErr(e instanceof Error ? e.message : 'failed'));
  }, [name]);

  const reveal = async () => {
    if (!secret) setSecret((await api.gatewaySecret(name)).secret);
    setShown((v) => !v);
  };
  const [bench, setBench] = useState<string | null>(null);
  const runBench = async () => {
    setBench('running…');
    try {
      const r = await api.runBenchmark(name);
      setBench(`${r.benchmark.passed}/${r.benchmark.total} passed · ${r.benchmark.passRate}%`);
    } catch (e) {
      setBench(e instanceof Error ? e.message : 'benchmark failed');
    }
  };

  const rotate = async () => {
    if (!window.confirm('Rotate the gateway secret? Your endpoint must switch to the new one.')) return;
    setSecret((await api.rotateGatewaySecret(name)).secret);
    setShown(true);
  };

  return (
    <div className="space-y-3 border-t border-border bg-surface-2/60 px-4 py-3" data-testid={`ops-${name}`}>
      {err && <p className="font-mono text-[12px] text-danger">{err}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-dim">gateway secret</span>
        <button type="button" onClick={reveal} className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 font-mono text-[11px] text-muted hover:text-fg">
          {shown ? <EyeOff size={11} /> : <Eye size={11} />} {shown ? 'hide' : 'reveal'}
        </button>
        <button type="button" onClick={rotate} className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 font-mono text-[11px] text-muted hover:text-danger">
          <RefreshCw size={11} /> rotate
        </button>
        {shown && secret && <code className="min-w-0 break-all font-mono text-[11px] text-fg">{secret}</code>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-dim">benchmark</span>
        <button type="button" onClick={runBench} disabled={bench === 'running…'} className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 font-mono text-[11px] text-muted hover:text-fg disabled:opacity-60">
          <FlaskConical size={11} /> run now
        </button>
        {bench && <span className="font-mono text-[11px] text-muted" role="status">{bench}</span>}
      </div>
      <p className="font-mono text-[11px] text-dim">
        verify on your side: hex(hmac_sha256(secret, timestamp + "." + raw_body)) == x-agenthive-signature, reject if |now − timestamp| &gt; 5 min
      </p>
      <div>
        <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-dim">recent runs{data ? ` · ${data.runs.length}` : ''}</p>
        {data && !data.runnable && <p className="text-[12px] text-muted">Not callable through the gateway: {data.reason}.</p>}
        {data && data.runs.length === 0 && data.runnable && <p className="text-[12px] text-muted">No runs yet. Try it from the Run tab or `agent-cli run {name}`.</p>}
        {data && data.runs.length > 0 && (
          <ul className="max-h-56 divide-y divide-border overflow-auto rounded-md border border-border font-mono text-[11px]">
            {data.runs.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-2 py-1.5">
                <span className="text-dim">{r.createdAt.slice(5, 19).replace('T', ' ')}</span>
                <span className="text-muted">{r.callerLogin}</span>
                <span className={STATUS_CLS[r.status]}>{r.status}</span>
                <span className="text-dim">{r.httpStatus ?? '—'}</span>
                <span className="ml-auto text-dim">{r.latencyMs}ms</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
