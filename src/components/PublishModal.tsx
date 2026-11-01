import { useEffect, useMemo, useState } from 'react';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { GithubIcon } from './ui/GithubIcon';
import { CATEGORIES, FRAMEWORKS, TRANSPORTS } from '../types';
import type { Agent, Category, Framework, Transport } from '../types';
import { Modal } from './ui/Modal';
import { CodeBlock } from './ui/CodeBlock';
import { api, blockedAuditFrom, issuesFrom, type AuditReport, type ManifestIssue } from '../lib/api';
import { ReportView } from './tabs/AuditTab';

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

type Phase = 'form' | 'pushing' | 'done';

const splitList = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

export function PublishModal({
  open,
  onClose,
  signedIn,
  onSignIn,
  onPublished,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  signedIn: boolean;
  onSignIn: () => void;
  onPublished: (a: Agent) => void;
  onOpen: (a: Agent) => void;
}) {
  const [phase, setPhase] = useState<Phase>('form');
  const [name, setName] = useState('');
  const [version, setVersion] = useState('0.1.0');
  const [value, setValue] = useState('');
  const [tagline, setTagline] = useState('');
  const [framework, setFramework] = useState<Framework>('MCP Server');
  const [category, setCategory] = useState<Category>('DevOps');
  const [transport, setTransport] = useState<Transport>('mcp/stdio');
  const [endpoint, setEndpoint] = useState('');
  const [tools, setTools] = useState('');
  const [capabilities, setCapabilities] = useState('');
  const [readme, setReadme] = useState('');
  const [declare, setDeclare] = useState(false);
  const [network, setNetwork] = useState('');
  const [filesystem, setFilesystem] = useState<'none' | 'read' | 'write'>('none');
  const [shell, setShell] = useState(false);
  const [envVars, setEnvVars] = useState('');
  const [sourceRepo, setSourceRepo] = useState('');
  const [sourceRef, setSourceRef] = useState('');
  const [blocked, setBlocked] = useState<AuditReport | null>(null);
  const [touched, setTouched] = useState(false);
  const [serverIssues, setServerIssues] = useState<ManifestIssue[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<{ agent: Agent; url: string; audit: AuditReport } | null>(null);

  const local: Record<string, string | null> = {
    'metadata.name': !name ? 'Required' : !NAME_RE.test(name) || name.length < 3 ? 'kebab-case, 3–48 chars' : null,
    'metadata.version': SEMVER_RE.test(version) ? null : 'semver, e.g. 0.1.0',
    'metadata.value': value.trim().length < 10 ? 'At least 10 characters' : null,
    'metadata.tagline': tagline.trim().length < 10 ? 'At least 10 characters' : null,
    'spec.endpoint': endpoint && !/^https:\/\//.test(endpoint) ? 'https:// only' : null,
    'spec.source.repo': sourceRepo && !/^https:\/\/github\.com\/[^/]+\/[^/]+/.test(sourceRepo) ? 'https://github.com/owner/repo' : null,
  };
  const errorFor = (path: string) => (touched ? (local[path] ?? serverIssues.find((i) => i.path === path)?.message ?? null) : null);
  const valid = Object.values(local).every((v) => v === null);

  const manifest = useMemo(
    () => ({
      apiVersion: 'agenthive.sh/v1',
      kind: 'Agent',
      metadata: { name, version, category, value: value.trim(), tagline: tagline.trim(), tags: [category.toLowerCase().split(' ')[0], framework.toLowerCase().split(' ')[0]] },
      spec: {
        framework,
        transport,
        ...(endpoint ? { endpoint } : {}),
        tools: splitList(tools),
        capabilities: splitList(capabilities),
        ...(declare ? { permissions: { network: splitList(network), filesystem, shell, env: splitList(envVars) } } : {}),
        ...(sourceRepo ? { source: { repo: sourceRepo.trim(), ...(sourceRef.trim() ? { ref: sourceRef.trim() } : {}) } } : {}),
      },
      readme: readme.trim(),
    }),
    [name, version, category, value, tagline, framework, transport, endpoint, tools, capabilities, readme, declare, network, filesystem, shell, envVars, sourceRepo, sourceRef],
  );

  useEffect(() => {
    if (!open) {
      setPhase('form');
      setTouched(false);
      setServerIssues([]);
      setServerError(null);
      setResult(null);
      setBlocked(null);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setServerIssues([]);
    setServerError(null);
    setBlocked(null);
    if (!valid) return;
    setPhase('pushing');
    try {
      const res = await api.publish(manifest);
      setResult(res);
      setPhase('done');
      onPublished(res.agent);
    } catch (err) {
      const issues = issuesFrom(err);
      const audit = blockedAuditFrom(err);
      if (audit) setBlocked(audit);
      else if (issues) setServerIssues(issues);
      else setServerError(err instanceof Error ? err.message : 'publish failed');
      setPhase('form');
    }
  };

  const field = 'w-full rounded-md border bg-[#0c0c0e] px-3 py-2 text-[13px] text-fg placeholder:text-dim focus:outline-none focus:border-accent/60';
  const border = (err: string | null) => (err ? 'border-danger/60' : 'border-border');
  const unmapped = serverIssues.filter((i) => !(i.path in local));

  return (
    <Modal open={open} onClose={onClose} title="Publish an agent">
      {!signedIn ? (
        <div className="space-y-4 p-5">
          <p className="text-[13.5px] leading-relaxed text-muted">
            Publishing needs an account: the first publisher owns the agent name, and every version is signed with your GitHub identity.
          </p>
          <button type="button" onClick={onSignIn} className="inline-flex items-center gap-2 rounded-md bg-fg px-3.5 py-2 text-[13px] font-medium text-bg hover:bg-fg/90">
            <GithubIcon size={15} /> Sign in to publish
          </button>
          <p className="font-mono text-[11.5px] text-dim">
            Prefer the terminal? <span className="text-muted">agent-cli login</span> then <span className="text-muted">agent-cli push ./agent.yaml</span>.
          </p>
        </div>
      ) : phase === 'done' && result ? (
        <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
          <div className="flex items-center gap-2 text-ok">
            <CheckCircle2 size={18} />
            <span className="font-mono text-[13px]">
              published {result.agent.name}@{result.agent.version} · grade {result.agent.grade}
            </span>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-dim">audit result</p>
            <ReportView agent={result.agent} report={result.audit} />
          </div>
          <CodeBlock label="your agent" lang="text" code={result.url} />
          <CodeBlock label="install" lang="bash" code={`agent-cli add ${result.agent.name}`} />
          <button type="button" onClick={() => onOpen(result.agent)} className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-black hover:bg-accent/90">
            Open it
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-1 flex-col overflow-hidden" noValidate>
          <div className="min-h-0 flex-1 space-y-4 overflow-auto p-5">
            <p className="text-[13px] text-muted">
              Same validation as <span className="font-mono text-fg">agent-cli push</span>. The manifest is stored under your name; nothing is executed.
            </p>

            {blocked && (
              <div className="rounded-lg border border-danger/40 bg-danger/10 p-3" role="alert">
                <p className="mb-2 font-mono text-[12px] font-semibold text-danger">Publish refused by the audit. Fix these and try again:</p>
                <ul className="space-y-1 text-[12.5px] text-fg/90">
                  {blocked.findings.filter((f) => f.severity === 'blocker').map((f, i) => (
                    <li key={i}>• {f.message}{f.hint ? <span className="text-muted"> — {f.hint}</span> : null}</li>
                  ))}
                </ul>
              </div>
            )}
            {serverError && (
              <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[12.5px] text-danger" role="alert">
                <AlertCircle size={14} className="mt-0.5 shrink-0" /> {serverError}
              </div>
            )}
            {unmapped.length > 0 && (
              <ul className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 font-mono text-[12px] text-danger" role="alert">
                {unmapped.map((i) => (
                  <li key={i.path + i.message}>
                    {i.path || 'manifest'}: {i.message}
                  </li>
                ))}
              </ul>
            )}

            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <Field label="Name" error={errorFor('metadata.name')} hint="first publisher owns it">
                <input className={`${field} font-mono ${border(errorFor('metadata.name'))}`} value={name} onChange={(e) => setName(e.target.value.toLowerCase())} placeholder="my-sql-agent" autoComplete="off" />
              </Field>
              <Field label="Version" error={errorFor('metadata.version')}>
                <input className={`${field} font-mono ${border(errorFor('metadata.version'))}`} value={version} onChange={(e) => setVersion(e.target.value)} />
              </Field>
            </div>

            <Field label="What it does for the user" error={errorFor('metadata.value')} hint="plain language, one sentence">
              <input className={`${field} ${border(errorFor('metadata.value'))}`} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Makes a slow Postgres query fast and tells you which index to add." />
            </Field>
            <Field label="Technical tagline" error={errorFor('metadata.tagline')}>
              <input className={`${field} ${border(errorFor('metadata.tagline'))}`} value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Reads EXPLAIN ANALYZE output, rewrites the SQL and proposes indexes." />
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Framework">
                <select className={`${field} border-border`} value={framework} onChange={(e) => setFramework(e.target.value as Framework)}>
                  {FRAMEWORKS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </Field>
              <Field label="Category">
                <select className={`${field} border-border`} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Transport">
                <select className={`${field} border-border font-mono`} value={transport} onChange={(e) => setTransport(e.target.value as Transport)}>
                  {TRANSPORTS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Endpoint (optional)" error={errorFor('spec.endpoint')} hint="your A2A/MCP endpoint, stored only, never called in v1">
              <input className={`${field} font-mono ${border(errorFor('spec.endpoint'))}`} value={endpoint} onChange={(e) => setEndpoint(e.target.value.trim())} placeholder="https://agents.example.com/my-sql-agent" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tools" hint="comma separated">
                <input className={`${field} font-mono ${border(errorFor('spec.tools'))}`} value={tools} onChange={(e) => setTools(e.target.value)} placeholder="Postgres, EXPLAIN Analyzer" />
              </Field>
              <Field label="Capabilities" hint="comma separated, dotted ids">
                <input className={`${field} font-mono ${border(errorFor('spec.capabilities'))}`} value={capabilities} onChange={(e) => setCapabilities(e.target.value)} placeholder="sql.explain, sql.rewrite" />
              </Field>
            </div>

            <details className="rounded-lg border border-border p-3" open={declare || Boolean(sourceRepo)}>
              <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-dim">
                Permissions &amp; source <span className="normal-case tracking-normal text-accent">· needed for AA and AAA</span>
              </summary>
              <div className="mt-3 space-y-3">
                <label className="flex items-center gap-2 text-[13px] text-fg">
                  <input type="checkbox" checked={declare} onChange={(e) => setDeclare(e.target.checked)} /> Declare what the agent touches at runtime
                </label>
                {declare && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Network hosts" hint="comma separated, or *">
                      <input className={`${field} font-mono border-border`} value={network} onChange={(e) => setNetwork(e.target.value)} placeholder="api.github.com, *.openai.com" />
                    </Field>
                    <Field label="Env vars read" hint="UPPER_SNAKE">
                      <input className={`${field} font-mono border-border`} value={envVars} onChange={(e) => setEnvVars(e.target.value)} placeholder="GITHUB_TOKEN" />
                    </Field>
                    <Field label="Filesystem">
                      <select className={`${field} border-border font-mono`} value={filesystem} onChange={(e) => setFilesystem(e.target.value as 'none' | 'read' | 'write')}>
                        <option value="none">none</option>
                        <option value="read">read</option>
                        <option value="write">write</option>
                      </select>
                    </Field>
                    <label className="flex items-center gap-2 self-end pb-2 text-[13px] text-fg">
                      <input type="checkbox" checked={shell} onChange={(e) => setShell(e.target.checked)} /> runs shell commands
                    </label>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                  <Field label="Source repository (GitHub, public)" error={errorFor('spec.source.repo')} hint="dependencies checked against OSV">
                    <input className={`${field} font-mono ${border(errorFor('spec.source.repo'))}`} value={sourceRepo} onChange={(e) => setSourceRepo(e.target.value)} placeholder="https://github.com/you/agent" />
                  </Field>
                  <Field label="Ref" hint="tag or branch">
                    <input className={`${field} font-mono border-border`} value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} placeholder="main" />
                  </Field>
                </div>
              </div>
            </details>

            <Field label="README (markdown, optional)" error={errorFor('readme')}>
              <textarea className={`${field} font-mono text-[12px] ${border(errorFor('readme'))}`} rows={5} value={readme} onChange={(e) => setReadme(e.target.value)} placeholder="What it needs, what it returns, limits." />
            </Field>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
            <span className="font-mono text-[11px] text-dim">POST /api/v1/agents · apiVersion agenthive.sh/v1</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-[13px] text-muted hover:text-fg">
                Cancel
              </button>
              <button
                type="submit"
                disabled={phase === 'pushing'}
                className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-black hover:bg-accent/90 disabled:opacity-60"
              >
                {phase === 'pushing' ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                Publish
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider text-dim">{label}</span>
        {error ? <span className="text-[11px] text-danger">{error}</span> : hint ? <span className="truncate text-[11px] text-dim">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

