import { useEffect, useState } from 'react';
import { BookOpen, FileCode2, Download, X, ShieldCheck, Play, Package, ListChecks } from 'lucide-react';
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

type TabId = 'overview' | 'run' | 'audit' | 'manifest' | 'package' | 'get';

export function AgentDetailModal({ agent, onClose, signedIn, onSignIn }: { agent: Agent | null; onClose: () => void; signedIn: boolean; onSignIn: () => void }) {
  const [tab, setTab] = useState<TabId>('overview');

  useEffect(() => {
    if (agent) setTab('overview');
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
              <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close">
                <X size={16} />
              </button>
            </div>
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
          </div>
        </>
      )}
    </Modal>
  );
}
