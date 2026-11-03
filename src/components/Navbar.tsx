import { useEffect, useRef, useState } from 'react';
import { Hexagon, Terminal, Upload, Code2, CircleHelp, LogOut, LayoutDashboard, Loader2, Trophy, Mail } from 'lucide-react';
import { GithubIcon } from './ui/GithubIcon';
import type { SessionUser } from '../lib/auth-client';
import { CopyButton } from './ui/CodeBlock';

import { CLI_PACKAGE_SPEC } from '../lib/manifest';

const INSTALL_CMD = `npm i -g ${CLI_PACKAGE_SPEC}`;

export interface NavbarSession {
  user: SessionUser | null;
  pending: boolean;
  onSignIn: (provider?: 'github' | 'google' | 'email') => void;
  providers?: { github: boolean; google: boolean; email: boolean };
  onSignOut: () => void;
  onDashboard: () => void;
}

export function Navbar({ onPush, onHow, onLeaderboard, nodeCount, session }: { onPush: () => void; onHow: () => void; onLeaderboard: () => void; nodeCount: number; session: NavbarSession }) {
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

        <div className="hidden items-center gap-2 font-mono text-[11px] text-muted md:flex" title="Registry status">
          <span className="relative inline-flex h-2 w-2 rounded-full bg-ok animate-pulse-dot" aria-hidden />
          <span>{nodeCount} agents</span>
          <span className="text-dim">·</span>
          <span>first trial soon</span>
        </div>

        <nav className="flex items-center gap-2">
          <a
            href="/leaderboard"
            onClick={(e) => {
              e.preventDefault();
              onLeaderboard();
            }}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-muted transition hover:bg-surface-2 hover:text-fg"
          >
            <Trophy size={14} />
            <span className="hidden sm:inline">Leaderboard</span>
          </a>
          <button
            type="button"
            onClick={onHow}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] text-muted transition hover:bg-surface-2 hover:text-fg"
          >
            <CircleHelp size={14} />
            <span className="hidden sm:inline">How it works</span>
            <span className="sm:hidden">Help</span>
          </button>
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
          {session.pending ? (
            <span className="inline-flex h-8 w-8 items-center justify-center text-dim" aria-label="Loading session">
              <Loader2 size={14} className="animate-spin" />
            </span>
          ) : session.user ? (
            <UserMenu user={session.user} onDashboard={session.onDashboard} onSignOut={session.onSignOut} />
          ) : (
            <SignInButton session={session} />
          )}
        </nav>
      </div>
    </header>
  );
}

function SignInButton({ session }: { session: NavbarSession }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const options = [session.providers?.github, session.providers?.google, session.providers?.email].filter(Boolean).length;
  const both = options > 1;
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  const cls = 'inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-[13px] text-muted transition hover:bg-surface-2 hover:text-fg';
  if (!both) {
    const google = session.providers?.google && !session.providers?.github;
    const email = session.providers?.email && !session.providers?.github && !session.providers?.google;
    return (
      <button type="button" onClick={() => session.onSignIn()} aria-label="Sign in" className={cls}>
        {email ? <Mail size={14} /> : google ? <GoogleIcon /> : <GithubIcon size={14} />}
        <span className="hidden sm:inline">Sign in</span>
      </button>
    );
  }
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Sign in" aria-haspopup="menu" aria-expanded={open} className={cls}>
        <GithubIcon size={14} />
        <span className="hidden sm:inline">Sign in</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-44 rounded-lg border border-border bg-surface p-1 shadow-2xl animate-fade-up">
          {session.providers?.github && (
            <button type="button" role="menuitem" onClick={() => session.onSignIn('github')} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-fg hover:bg-surface-2">
              <GithubIcon size={14} /> GitHub
            </button>
          )}
          {session.providers?.google && (
            <button type="button" role="menuitem" onClick={() => session.onSignIn('google')} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-fg hover:bg-surface-2">
              <GoogleIcon /> Google
            </button>
          )}
          {session.providers?.email && (
            <button type="button" role="menuitem" onClick={() => session.onSignIn('email')} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-fg hover:bg-surface-2">
              <Mail size={14} /> Email
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.7h5.4c-.2 1.2-.9 2.3-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" opacity=".9" />
      <path fill="currentColor" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6C4.8 19.8 8.1 22 12 22z" opacity=".7" />
      <path fill="currentColor" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1C2.4 8.8 2 10.4 2 12s.4 3.2 1.1 4.6L6.4 14z" opacity=".5" />
      <path fill="currentColor" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8C17 3 14.7 2 12 2 8.1 2 4.8 4.2 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z" opacity=".8" />
    </svg>
  );
}

function UserMenu({ user, onDashboard, onSignOut }: { user: SessionUser; onDashboard: () => void; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = user.login ?? user.name;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Account menu for ${label}`}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-2 font-mono text-[12px] text-fg hover:border-accent/60"
      >
        {user.image ? <img src={user.image} alt="" className="h-full w-full object-cover" /> : label.slice(0, 2).toUpperCase()}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-surface p-1 shadow-2xl animate-fade-up" role="menu">
          <p className="truncate px-2.5 py-1.5 font-mono text-[11px] text-dim">@{label}</p>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onDashboard(); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-muted hover:bg-surface-2 hover:text-fg">
            <LayoutDashboard size={14} /> Dashboard
          </button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onSignOut(); }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-muted hover:bg-surface-2 hover:text-fg">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
