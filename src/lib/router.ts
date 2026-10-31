import { useCallback, useEffect, useState } from 'react';

export type Route = { kind: 'home' } | { kind: 'agent'; name: string };

const AGENT_RE = /^\/agents\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/;

export function parseRoute(pathname: string): Route {
  const m = AGENT_RE.exec(pathname);
  return m ? { kind: 'agent', name: m[1] } : { kind: 'home' };
}

export function agentPath(name: string): string {
  return `/agents/${name}`;
}

export function useRoute(): [Route, (path: string, opts?: { replace?: boolean }) => void] {
  const [route, setRoute] = useState<Route>(() =>
    typeof window === 'undefined' ? { kind: 'home' } : parseRoute(window.location.pathname),
  );

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((path: string, opts?: { replace?: boolean }) => {
    if (window.location.pathname === path) return;
    if (opts?.replace) window.history.replaceState(null, '', path);
    else window.history.pushState(null, '', path);
    setRoute(parseRoute(path));
  }, []);

  return [route, navigate];
}
