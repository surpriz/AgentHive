import { useEffect, useState } from 'react';
import { BookOpen, FileCode2, Download, X, ShieldCheck, Play, Package, ListChecks, FlaskConical, Flag } from 'lucide-react';
import { api } from '../lib/api';
import { agentPath } from '../lib/router';
import { CopyButton } from './ui/CodeBlock';
import type { Agent } from '../types';
import { Modal } from './ui/Modal';
import { Tabs } from './ui/Tabs';
import { Badge, FrameworkBadge, TrustBadge } from './ui/Badge';
import { OverviewTab } from './tabs/OverviewTab';
import { ManifestTab } from './tabs/ManifestTab';
import { AuditTab } from './tabs/AuditTab';
import { RunTab, runnableReason } from './tabs/RunTab';
import { PackageTab } from './tabs/PackageTab';
import { GetTab } from './tabs/GetTab';
import { TrialTab } from './tabs/TrialTab';

type TabId = 'overview' | 'run' | 'audit' | 'manifest' | 'package' | 'get' | 'trial';

export function AgentDetailModal({ agent, onClose, signedIn, onSignIn }: { agent: Agent | null; onClose: () => void; signedIn: boolean; onSignIn: () => void }) {
  const [tab, setTab] = useState<TabId>('overview');
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    if (agent) {
      setTab('overview');
      setReporting(false);
    }
  }, [agent?.id]);

  return (
    <Modal open={agent !== null} onClose={onClose} variant="drawer" labelledBy="agent-title">
      {agent && (
        <>
          <div className="border-b border-border px-5 pb-4 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 id="agent-title" className="truncate font-mono text-base font-semibold text-fg">
                    {agent.name}
                  </h2>
                  <Badge>v{agent.version}</Badge>
                </div>
                <p className="mt-0.5 flex items-center gap-2 font-mono text-[11px] text-dim">
                  <span>agenthive.sh/{agent.author}/{agent.name}</span>
                  <CopyButton text={`${window.location.origin}${agentPath(agent.name)}`} label="Share" className="!px-1.5 !py-0.5" />
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => setReporting((r) => !r)} aria-expanded={reporting} className="rounded-md p-1 text-dim hover:bg-surface-2 hover:text-fg" aria-label="Report this agent" title="Report this agent">
                  <Flag size={14} />
                </button>
                <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close">
                  <X size={16} />
                </button>
              </div>
            </div>
            {reporting && <ReportForm name={agent.name} onDone={() => setReporting(false)} />}
            <p className="mt-2 text-[13.5px] text-fg/90">{agent.value}</p>
            <p className="mt-1 text-[12.5px] text-muted">{agent.tagline}</p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <FrameworkBadge framework={agent.framework} />
              <Badge mono={false}>{agent.goal ?? agent.category}</Badge>
              <button type="button" onClick={() => setTab('audit')} className="rounded-md" aria-label={agent.apiVersion === 'v2' ? 'Open checks' : 'Open audit'}>
                <TrustBadge agent={agent} title={agent.grade === 'pending' ? 'Audit pending' : `Computed by the registry audit · ${agent.score}/100`} />
              </button>
              <button
                type="button"
                onClick={() => setTab(agent.apiVersion === 'v2' ? 'get' : 'manifest')}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-accent/50 bg-accent/10 px-2.5 py-1 font-mono text-[12px] text-accent hover:bg-accent/20"
              >
                <Download size={12} /> {agent.apiVersion === 'v2' ? 'Get it' : 'Install'}
              </button>
            </div>
          </div>

          <Tabs<TabId>
            tabs={
              agent.apiVersion === 'v2'
                ? [
                    { id: 'overview', label: 'Overview', icon: <BookOpen size={14} /> },
                    { id: 'package', label: 'Package', icon: <Package size={14} /> },
                    { id: 'audit', label: 'Checks', icon: <ListChecks size={14} /> },
                    { id: 'trial', label: 'Trial', icon: <FlaskConical size={14} /> },
                    { id: 'get', label: 'Get it', icon: <Download size={14} /> },
                  ]
                : [
                    { id: 'overview', label: 'Overview', icon: <BookOpen size={14} /> },
                    ...(runnableReason(agent) === null ? [{ id: 'run' as const, label: 'Run', icon: <Play size={14} /> }] : []),
                    { id: 'audit', label: 'Audit', icon: <ShieldCheck size={14} /> },
                    { id: 'manifest', label: 'A2A & MCP Manifest', icon: <FileCode2 size={14} /> },
                  ]
            }
            active={tab}
            onChange={setTab}
          />

          <div className="flex-1 overflow-auto p-5" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'overview' && <OverviewTab agent={agent} />}
            {tab === 'run' && <RunTab agent={agent} signedIn={signedIn} onSignIn={onSignIn} />}
            {tab === 'audit' && <AuditTab agent={agent} />}
            {tab === 'manifest' && <ManifestTab agent={agent} />}
            {tab === 'package' && <PackageTab agent={agent} />}
            {tab === 'get' && <GetTab agent={agent} />}
            {tab === 'trial' && <TrialTab agent={agent} />}
          </div>
        </>
      )}
    </Modal>
  );
}

/** A report goes to the maintainers, who hide the agent or dismiss it. Nothing is posted publicly. */
function ReportForm({ name, onDone }: { name: string; onDone: () => void }) {
  const [reason, setReason] = useState<'security' | 'rights' | 'other'>('security');
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    setError(null);
    try {
      await api.report(name, { reason, details, ...(email ? { email } : {}) });
      setState('sent');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'could not send');
    }
  };

  if (state === 'sent') {
    return (
      <p role="status" className="mt-3 rounded-md border border-ok/40 bg-ok/10 px-3 py-2 text-[12px] text-ok" data-testid="report-sent">
        Report sent. Security reports are looked at within 48 hours; the agent is hidden while reviewed if the report holds.{' '}
        <button type="button" onClick={onDone} className="underline">close</button>
      </p>
    );
  }
  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-md border border-border bg-surface-2 p-3" data-testid="report-form">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <label className="text-dim" htmlFor="report-reason">Report as</label>
        <select id="report-reason" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className="rounded border border-border bg-bg px-2 py-1 font-mono text-[12px] text-fg">
          <option value="security">security risk (secret, malicious instruction, exfiltration)</option>
          <option value="rights">rights issue (license, copyright, name)</option>
          <option value="other">something else</option>
        </select>
      </div>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        required
        minLength={10}
        maxLength={2000}
        rows={3}
        placeholder="What did you find, and where in the package? At least 10 characters."
        className="w-full rounded border border-border bg-bg px-2 py-1.5 text-[12.5px] text-fg placeholder:text-dim"
        aria-label="Report details"
      />
      <div className="flex flex-wrap items-center gap-2">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your email, if you want an answer (optional)" className="min-w-0 flex-1 rounded border border-border bg-bg px-2 py-1 text-[12px] text-fg placeholder:text-dim" aria-label="Your email (optional)" />
        <button type="submit" disabled={state === 'sending'} className="rounded-md border border-accent/50 bg-accent/10 px-2.5 py-1 font-mono text-[12px] text-accent hover:bg-accent/20 disabled:opacity-50">
          {state === 'sending' ? 'sending…' : 'send report'}
        </button>
        <button type="button" onClick={onDone} className="font-mono text-[12px] text-dim hover:text-fg">cancel</button>
      </div>
      {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
    </form>
  );
}
