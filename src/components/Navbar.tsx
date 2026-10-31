import { useEffect, useRef, useState } from 'react';
import { Hexagon, Terminal, Upload, Code2 } from 'lucide-react';
import { CopyButton } from './ui/CodeBlock';

const INSTALL_CMD = 'npm i -g @agenthive/cli';

export function Navbar({ onPush, nodeCount }: { onPush: () => void; nodeCount: number }) {
  const [cliOpen, setCliOpen] = useState(false);
  const cliRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cliOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!cliRef.current?.contains(e.target as Node)) setCliOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setCliOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [cliOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        <a href="/" className="flex items-center gap-2" aria-label="agenthive.sh home">
          <Hexagon size={20} className="text-accent" strokeWidth={2.2} />
          <span className="font-mono text-sm font-semibold tracking-tight">
            agenthive<span className="text-accent">.sh</span>
            <span className="ml-0.5 inline-block w-[7px] animate-blink bg-accent/80 align-middle" style={{ height: '0.95em' }} aria-hidden />
          </span>
        </a>

        <div className="hidden items-center gap-2 font-mono text-[11px] text-muted md:flex" title="Registry mesh status">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-ok animate-pulse-dot" aria-hidden />
          <span>mesh online</span>
          <span className="text-dim">·</span>
          <span>{nodeCount} nodes</span>
          <span className="text-dim">·</span>
          <span>v0.1</span>
        </div>

        <nav className="flex items-center gap-2">
          <div className="relative" ref={cliRef}>
            <button
              type="button"
              onClick={() => setCliOpen((v) => !v)}
              aria-expanded={cliOpen}
              className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-muted transition hover:bg-surface-2 hover:text-fg sm:inline-flex"
            >
              <Terminal size={14} />
              CLI
            </button>
            {cliOpen && (
              <div className="absolute right-0 mt-2 w-[360px] rounded-lg border border-border bg-surface p-3 shadow-2xl animate-fade-up">
                <p className="mb-2 text-[12px] text-muted">Install the AgentHive CLI</p>
                <div className="flex items-center gap-2 rounded-md border border-border bg-[#0c0c0e] px-2.5 py-2">
                  <code className="flex-1 truncate font-mono text-[12px] text-fg/90">
                    <span className="text-dim">$ </span>
                    {INSTALL_CMD}
                  </code>
                  <CopyButton text={INSTALL_CMD} />
                </div>
                <p className="mt-2 font-mono text-[11px] text-dim">
                  then: <span className="text-muted">agent-cli search sql</span> · <span className="text-muted">agent-cli setup</span> adds the catalog to Claude Code
                </p>
              </div>
            )}
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-md p-1.5 text-muted transition hover:bg-surface-2 hover:text-fg sm:inline-flex"
            aria-label="Source"
          >
            <Code2 size={16} />
          </a>
          <button
            type="button"
            onClick={onPush}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-black transition hover:bg-accent/90 active:scale-[0.98]"
          >
            <Upload size={14} />
            <span className="hidden sm:inline">Push Agent</span>
            <span className="sm:hidden">Push</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
