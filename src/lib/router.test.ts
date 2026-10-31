import { describe, expect, it } from 'vitest';
import { agentPath, parseRoute } from './router';

describe('router', () => {
  it('parses agent routes and ignores everything else', () => {
    expect(parseRoute('/')).toEqual({ kind: 'home' });
    expect(parseRoute('/agents/pg-query-optimizer')).toEqual({ kind: 'agent', name: 'pg-query-optimizer' });
    expect(parseRoute('/agents/pg-query-optimizer/')).toEqual({ kind: 'agent', name: 'pg-query-optimizer' });
    expect(parseRoute('/agents/pg-query-optimizer/agent.json')).toEqual({ kind: 'home' });
    expect(parseRoute('/agents/Not_Valid')).toEqual({ kind: 'home' });
    expect(parseRoute('/api/agents.json')).toEqual({ kind: 'home' });
  });

  it('agentPath round-trips through parseRoute', () => {
    expect(parseRoute(agentPath('eu-ai-act-auditor'))).toEqual({ kind: 'agent', name: 'eu-ai-act-auditor' });
  });
});
