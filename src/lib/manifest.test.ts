import { describe, expect, it } from 'vitest';
import { buildAgentCard, buildClaudeJson, buildCursorRules, buildManifestYaml, buildRegistryIndex, buildCliInstall } from './manifest';
import { mockAgents } from '../data/mockAgents';

const pg = mockAgents.find((a) => a.name === 'pg-query-optimizer')!;
const li = mockAgents.find((a) => a.name === 'linkedin-outreach-agent')!;

describe('manifest builders', () => {
  it('yaml carries identity, transport and every tool', () => {
    const y = buildManifestYaml(pg);
    expect(y).toContain('name: pg-query-optimizer');
    expect(y).toContain('version: 3.0.4');
    expect(y).toContain('transport: mcp/stdio');
    for (const t of pg.tools) expect(y).toContain(`- ${t}`);
    expect(buildManifestYaml(li)).toContain('transport: a2a/http+json');
  });

  it('hosted agents are called through the gateway, packages are pulled', () => {
    expect(buildClaudeJson(pg)).toContain('agent-cli run pg-query-optimizer');
    expect(buildCliInstall(pg)).toContain('agent-cli run pg-query-optimizer');
    const pkg = { ...pg, apiVersion: 'v2' as const };
    expect(buildClaudeJson(pkg)).toContain('agent-cli pull pg-query-optimizer --target claude');
    expect(buildCursorRules(pkg)).toContain('--target cursor');
  });

  it('agent card exposes one skill per capability and agenthive extensions', () => {
    const card = buildAgentCard(pg);
    expect(card.skills.map((s) => s.id)).toEqual(pg.capabilities);
    expect(card.documentationUrl).toBe('https://agenthive.sh/agents/pg-query-optimizer');
    expect(card['x-agenthive'].securityGrade).toBe('AA');
    expect(() => JSON.stringify(card)).not.toThrow();
  });

  it('registry index lists every agent with card + install links', () => {
    const idx = buildRegistryIndex(mockAgents);
    expect(idx.count).toBe(mockAgents.length);
    const entry = idx.agents.find((a) => a.name === 'pg-query-optimizer')!;
    expect(entry.agentCard).toBe('https://agenthive.sh/agents/pg-query-optimizer/agent.json');
    expect(entry.install).toBe("agent-cli run pg-query-optimizer --input '{}'");
    expect(entry.apiVersion).toBe('v1');
  });
});
