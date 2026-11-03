import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Info, Loader2, ExternalLink, CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import type { Agent } from '../../types';
import { api, type AuditReport, type AuditResponse } from '../../lib/api';
import { GradeBadge, ChecksBadge } from '../ui/Badge';

const SEVERITY: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  blocker: { label: 'blocker', cls: 'text-danger border-danger/40 bg-danger/10', icon: <ShieldAlert size={13} /> },
  high: { label: 'high', cls: 'text-danger border-danger/40 bg-danger/5', icon: <AlertTriangle size={13} /> },
  medium: { label: 'medium', cls: 'text-warn border-warn/40 bg-warn/10', icon: <AlertTriangle size={13} /> },
  low: { label: 'low', cls: 'text-muted border-border bg-surface-2', icon: <Info size={13} /> },
};

const CHECK_LABEL: Record<string, string> = {
  secrets: 'Secrets in the manifest',
  endpoint: 'Declared endpoint',
  permissions: 'Declared permissions',
  dependencies: 'Dependencies (OSV)',
  completeness: 'Manifest completeness',
  bricks: 'Bricks pinned and published',
  vulnerabilities: 'Known vulnerabilities in bricks (OSV)',
  scripts: 'No executable content',
};

const CHECK_LABEL_V2: Record<string, string> = {
  ...CHECK_LABEL,
  secrets: 'No secrets in the package',
  permissions: 'MCP permissions declared',
  completeness: 'Package completeness',
};

export function AuditTab({ agent, report: initial }: { agent: Agent; report?: AuditReport | null }) {
  const [data, setData] = useState<AuditResponse | null>(initial ? { agent: agent.name, version: agent.version, grade: agent.grade, score: agent.score, criteria: '/docs/grading', report: initial } : null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    api
      .audit(agent.name)
      .then((r) => !cancelled && setData(r))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'failed to load the audit'));
    return () => {
      cancelled = true;
    };
  }, [agent.name, initial]);

  if (error) return <p className="font-mono text-[12px] text-danger">{error}</p>;
  if (!data) {
    return (
      <p className="flex items-center gap-2 font-mono text-[12px] text-dim">
        <Loader2 size={13} className="animate-spin" /> loading audit…
      </p>
    );
  }
  return <ReportView agent={agent} report={data.report} criteria={data.criteria} />;
}

export function ReportView({ agent, report, criteria = '/docs/grading' }: { agent: Agent; report: AuditReport | null; criteria?: string }) {
  if (!report) {
    return (
      <div className="rounded-lg border border-border bg-surface-2 p-4 text-[13px] text-muted">
        No audit yet. The grade is <span className="font-mono text-fg">pending</span> until the registry runs its checks.
      </div>
    );
  }
  const bySeverity = ['blocker', 'high', 'medium', 'low'].map((s) => ({ s, items: report.findings.filter((f) => f.severity === s) })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5">
      {agent.apiVersion === 'v2' && (
        <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[12.5px] leading-relaxed text-muted" role="note" data-testid="checks-note">
          <span className="font-semibold text-fg">{report.checks.filter((c) => c.status === 'ok').length}/{report.checks.length} checks passed.</span> These checks look at secrets, pinned versions, known vulnerabilities, permissions and executable content. They do not read the prompt for intent: install only what you have read in the Package tab.
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border bg-surface-2 p-3">
          <div className="text-[11px] text-dim">{agent.apiVersion === 'v2' ? 'checks' : 'grade'}</div>
          <div className="mt-1">{agent.apiVersion === 'v2' ? <ChecksBadge grade={report.blocked ? 'B' : report.grade} score={report.score} /> : <GradeBadge grade={report.blocked ? 'B' : report.grade} title="Computed by the registry audit" />}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface-2 p-3">
          <div className="text-[11px] text-dim">score</div>
          <div className="mt-1 font-mono text-lg font-semibold text-fg">{report.score}<span className="text-[11px] text-dim">/100</span></div>
        </div>
        <div className="rounded-lg border border-border bg-surface-2 p-3">
          <div className="text-[11px] text-dim">audited</div>
          <div className="mt-1 font-mono text-[12px] text-fg">{report.auditedAt.slice(0, 10)}</div>
          <div className="font-mono text-[10px] text-dim">engine {report.engine}</div>
        </div>
      </div>

      {report.caps.length > 0 && (
        <section>
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-dim">grade capped at {report.caps.map((c) => c.grade).sort()[0]}</h3>
          <ul className="space-y-1">
            {report.caps.map((c) => (
              <li key={c.reason} className="flex items-start gap-2 text-[12.5px] text-muted">
                <MinusCircle size={13} className="mt-0.5 shrink-0 text-warn" /> {c.reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(
        <section>
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-dim">findings · {report.findings.length}</h3>
          {report.findings.length === 0 ? (
            <p className="flex items-center gap-2 text-[13px] text-ok">
              <ShieldCheck size={14} /> nothing to report
            </p>
          ) : (
            <div className="space-y-3">
              {bySeverity.map((g) => (
                <ul key={g.s} className="space-y-1.5">
                  {g.items.map((f, i) => {
                    const m = SEVERITY[f.severity];
                    return (
                      <li key={i} className={`rounded-md border px-3 py-2 text-[12.5px] ${m.cls}`}>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
                          {m.icon} {m.label} <span className="normal-case tracking-normal text-dim">· {(agent.apiVersion === 'v2' ? CHECK_LABEL_V2 : CHECK_LABEL)[f.check] ?? f.check}</span>
                        </div>
                        <div className="mt-0.5 text-fg/90">{f.message}</div>
                        {f.hint && <div className="mt-0.5 text-[12px] text-muted">{f.hint}</div>}
                      </li>
                    );
                  })}
                </ul>
              ))}
            </div>
          )}
        </section>
      )}

      {report.checks.length > 0 && (
        <section>
          <h3 className="mb-2 font-mono text-[11px] uppercase tracking-wider text-dim">checks</h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {report.checks.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-[12.5px]">
                {c.status === 'ok' ? <CheckCircle2 size={13} className="text-ok" /> : c.status === 'skipped' ? <MinusCircle size={13} className="text-dim" /> : <XCircle size={13} className="text-danger" />}
                <span className="text-fg">{(agent.apiVersion === 'v2' ? CHECK_LABEL_V2 : CHECK_LABEL)[c.id] ?? c.id}</span>
                <span className="ml-auto font-mono text-[11px] text-dim">{c.note ?? c.status} · {c.ms}ms</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="font-mono text-[11px] text-dim">
        <a href={criteria} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
          how grades are computed <ExternalLink size={11} />
        </a>
      </p>
    </div>
  );
}
