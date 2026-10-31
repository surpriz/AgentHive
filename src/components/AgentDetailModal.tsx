import { useEffect, useState } from 'react';
import { BookOpen, FileCode2, TerminalSquare, Download, X } from 'lucide-react';
import { agentPath } from '../lib/router';
import { CopyButton } from './ui/CodeBlock';
import type { Agent } from '../types';
import { Modal } from './ui/Modal';
import { Tabs } from './ui/Tabs';
import { Badge, FrameworkBadge, GradeBadge } from './ui/Badge';
import { OverviewTab } from './tabs/OverviewTab';
import { ManifestTab } from './tabs/ManifestTab';
import { SandboxView } from './tabs/SandboxView';

type TabId = 'overview' | 'manifest' | 'sandbox';

export function AgentDetailModal({ agent, onClose }: { agent: Agent | null; onClose: () => void }) {
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
              <Badge mono={false}>{agent.category}</Badge>
              <GradeBadge grade={agent.grade} />
              <button
                type="button"
                onClick={() => setTab('manifest')}
                className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-accent/50 bg-accent/10 px-2.5 py-1 font-mono text-[12px] text-accent hover:bg-accent/20"
              >
                <Download size={12} /> Install
              </button>
            </div>
          </div>

          <Tabs<TabId>
            tabs={[
              { id: 'overview', label: 'Overview', icon: <BookOpen size={14} /> },
              { id: 'manifest', label: 'A2A & MCP Manifest', icon: <FileCode2 size={14} /> },
              { id: 'sandbox', label: 'Sandbox (simulated)', icon: <TerminalSquare size={14} /> },
            ]}
            active={tab}
            onChange={setTab}
          />

          <div className="flex-1 overflow-auto p-5" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'overview' && <OverviewTab agent={agent} />}
            {tab === 'manifest' && <ManifestTab agent={agent} />}
            {tab === 'sandbox' && <SandboxView agent={agent} />}
          </div>
        </>
      )}
    </Modal>
  );
}
