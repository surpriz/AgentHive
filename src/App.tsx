import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { FilterBar } from './components/FilterBar';
import { AgentGrid } from './components/AgentGrid';
import { AgentDetailModal } from './components/AgentDetailModal';
import { PublishModal } from './components/PublishModal';
import { HowItWorksModal } from './components/HowItWorksModal';
import { SignInModal } from './components/SignInModal';
import { Dashboard } from './components/Dashboard';
import { Leaderboard } from './components/Leaderboard';
import { EMPTY_FILTERS, filterAgents } from './lib/filters';
import { agentPath, useRoute } from './lib/router';
import { api, type RegistryConfig } from './lib/api';
import { authClient, type SessionUser } from './lib/auth-client';
import type { Agent, Filters } from './types';

export default function App() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [route, navigate] = useRoute();
  const [publishOpen, setPublishOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<RegistryConfig | null>(null);
  const session = authClient.useSession();
  const user = (session.data?.user as SessionUser | undefined) ?? null;

  const reload = useCallback(async () => {
    try {
      setAgents(await api.catalog());
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'failed to load the registry');
    }
  }, []);

  useEffect(() => {
    void reload();
    api.config().then(setConfig).catch(() => setConfig({ github: false, devLogin: false }));
  }, [reload]);

  const list = agents ?? [];
  const selected = useMemo<Agent | null>(() => (route.kind === 'agent' ? (list.find((a) => a.name === route.name) ?? null) : null), [route, list]);
  const notFound = route.kind === 'agent' && agents !== null && selected === null;
  const visible = useMemo(() => filterAgents(list, filters), [list, filters]);

  const openAgent = useCallback((a: Agent) => navigate(agentPath(a.name)), [navigate]);
  const closeDetail = useCallback(() => navigate(route.kind === 'dashboard' ? '/dashboard' : route.kind === 'leaderboard' ? '/leaderboard' : '/'), [navigate, route.kind]);
  const closePublish = useCallback(() => setPublishOpen(false), []);
  const closeHow = useCallback(() => setHowOpen(false), []);

  const signIn = useCallback(
    async (provider?: 'github' | 'google' | 'email') => {
      if (provider === 'email') return setSignInOpen(true);
      const chosen = provider ?? (config?.github ? 'github' : config?.google ? 'google' : null);
      if (chosen && config?.[chosen]) {
        await authClient.signIn.social({ provider: chosen, callbackURL: '/dashboard' });
      } else if (config?.devLogin && config.devUser) {
        await authClient.signIn.email({ email: config.devUser.email, password: config.devUser.password });
      } else if (config?.email) {
        setSignInOpen(true);
      } else {
        window.alert('Sign-in is not configured on this deployment yet.');
      }
    },
    [config],
  );

  const signOut = useCallback(async () => {
    await authClient.signOut();
    if (route.kind === 'dashboard') navigate('/');
  }, [navigate, route.kind]);

  useEffect(() => {
    if (route.kind === 'dashboard' && !session.isPending && !user) navigate('/', { replace: true });
  }, [route.kind, session.isPending, user, navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (e.key === '/' && !typing && route.kind === 'home' && !publishOpen && !howOpen) {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [route, publishOpen, howOpen]);

  useEffect(() => {
    const base = 'agenthive.sh';
    const desc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (selected) {
      document.title = `${selected.name} · ${base}`;
      desc?.setAttribute('content', `${selected.value} ${selected.framework} · ${selected.category} · grade ${selected.grade}.`);
    } else if (route.kind === 'dashboard') {
      document.title = `Dashboard · ${base}`;
    } else if (route.kind === 'leaderboard') {
      document.title = `Leaderboard · ${base}`;
      desc?.setAttribute('content', 'AgentHive leaderboard: hosted agents ranked per category from measured benchmark, audit and availability numbers.');
    } else {
      document.title = `${base} — The proving ground for AI agents`;
      desc?.setAttribute('content', 'AgentHive runs AI agents through the same real tests and publishes which one does the job. Read the package, pull it into Claude Code or Cursor, improve it and resubmit.');
    }
  }, [selected, route.kind]);

  const onPublished = (a: Agent) => {
    setNewIds((prev) => new Set(prev).add(a.id));
    setFilters(EMPTY_FILTERS);
    void reload();
  };

  const stats = useMemo(() => {
    const goals = new Set(list.map((a) => a.goal ?? a.category)).size;
    const checked = list.filter((a) => a.grade !== 'pending').length;
    const packages = list.filter((a) => a.apiVersion === 'v2').length;
    return { goals, checked, packages };
  }, [list]);

  return (
    <div className="min-h-screen grid-bg">
      <Navbar
        onPush={() => setPublishOpen(true)}
        onHow={() => setHowOpen(true)}
        nodeCount={list.length}
        session={{ user, pending: session.isPending, onSignIn: signIn, providers: { github: Boolean(config?.github), google: Boolean(config?.google), email: Boolean(config?.email) }, onSignOut: signOut, onDashboard: () => navigate('/dashboard') }}
        onLeaderboard={() => navigate('/leaderboard')}
      />

      <main className="mx-auto max-w-7xl px-4 pb-20">
        {route.kind === 'leaderboard' ? (
          <section className="py-10">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-dim">leaderboard</p>
            <h1 className="mb-2 text-2xl font-semibold tracking-tight text-fg">Ranked from measured numbers only.</h1>
            <p className="mb-8 max-w-2xl text-[14px] text-muted">Hosted agents, per category: benchmark pass rate, audit score and gateway availability. Nothing here is declared by an author. Packages will be ranked by trial results once the first trial runs.</p>
            <Leaderboard onOpen={(name) => navigate(agentPath(name))} />
          </section>
        ) : route.kind === 'dashboard' ? (
          <section className="py-10">
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-dim">dashboard</p>
            <h1 className="mb-8 text-2xl font-semibold tracking-tight text-fg">
              {user ? <>@{user.login ?? user.name}</> : 'Signing in…'}
            </h1>
            {user && <Dashboard onOpenAgent={openAgent} onPush={() => setPublishOpen(true)} />}
          </section>
        ) : (
          <>
            <section className="py-10 sm:py-14">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" /> proving ground · first trial: code audit · in preparation
              </p>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-fg sm:text-5xl">
                Find the agent that <span className="text-accent">actually does the job</span>.
              </h1>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted">
                AgentHive runs AI agents through the same real tests and publishes which one does the work. Agents are text packages you can read in full, pull into Claude Code or Cursor in one action, and improve.{' '}
                <button type="button" onClick={() => setHowOpen(true)} className="text-accent underline-offset-4 hover:underline">
                  How it works →
                </button>
              </p>
              <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 font-mono text-[12px] text-dim">
                <div><dt className="inline">agents </dt><dd className="inline text-fg">{agents ? list.length : '…'}</dd></div>
                <div><dt className="inline">packages </dt><dd className="inline text-fg">{agents ? stats.packages : '…'}</dd></div>
                <div><dt className="inline">goals </dt><dd className="inline text-fg">{agents ? stats.goals : '…'}</dd></div>
                <div><dt className="inline">checked </dt><dd className="inline text-ok">{agents ? `${stats.checked}/${list.length}` : '…'}</dd></div>
                <div><dt className="inline">trial results </dt><dd className="inline text-muted">soon</dd></div>
              </dl>
            </section>

            {notFound && route.kind === 'agent' && (
              <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 font-mono text-[12px] text-warn">
                <span>
                  404 · no agent named <span className="text-fg">{route.name}</span> in the registry.
                </span>
                <button type="button" onClick={closeDetail} className="rounded-md border border-warn/40 px-2 py-0.5 hover:bg-warn/10">
                  back to catalog
                </button>
              </div>
            )}
            {loadError && (
              <div role="alert" className="mb-6 flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 font-mono text-[12px] text-danger">
                <AlertCircle size={14} /> registry unreachable: {loadError}
                <button type="button" onClick={() => void reload()} className="ml-auto rounded-md border border-danger/40 px-2 py-0.5 hover:bg-danger/10">
                  retry
                </button>
              </div>
            )}
            <div className="space-y-6">
              <FilterBar filters={filters} onChange={setFilters} count={visible.length} total={list.length} />
              {agents === null && !loadError ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading agents">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-[232px] animate-pulse rounded-xl border border-border bg-surface" />
                  ))}
                </div>
              ) : (
                <AgentGrid agents={visible} onOpen={openAgent} newIds={newIds} onReset={() => setFilters(EMPTY_FILTERS)} />
              )}
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 py-6 font-mono text-[11px] text-dim sm:flex-row sm:items-center">
          <span>agenthive.sh · the proving ground for AI agents</span>
          <span className="inline-flex items-center gap-2">
            {agents === null && !loadError && <Loader2 size={11} className="animate-spin" />}
            next: first trial (code audit) · recorded runs · ranking per trial
          </span>
        </div>
      </footer>

      <AgentDetailModal agent={selected} onClose={closeDetail} signedIn={user !== null} onSignIn={signIn} />
      <PublishModal
        open={publishOpen}
        onClose={closePublish}
        signedIn={user !== null}
        onSignIn={signIn}
        onPublished={onPublished}
        onOpen={(a) => {
          setPublishOpen(false);
          openAgent(a);
        }}
      />
      <HowItWorksModal open={howOpen} onClose={closeHow} />
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} config={config} onSocial={(p) => void signIn(p)} />
    </div>
  );
}
