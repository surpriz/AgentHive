import { describe, expect, it } from 'vitest';
import { buildLayout, copyPrompt, mcpEntryFor, renderPrompt } from './retrieval';

const pkg = {
  name: 'secret-hunter',
  version: '1.0.0',
  author: 'surpriz',
  value: 'Finds leaked secrets.',
  settings: [{ name: 'max_findings', type: 'integer' as const, default: 10 }],
  bricks: {
    skills: ['secret-patterns'],
    mcp: [
      { name: 'filesystem', package: 'npm:@modelcontextprotocol/server-filesystem@2.1.0', args: ['.'], env: [], permissions: { network: [], filesystem: 'read' as const } },
      { name: 'github', package: 'npm:@modelcontextprotocol/server-github@2025.4.8', args: [], env: ['GITHUB_PERSONAL_ACCESS_TOKEN'], permissions: { network: ['api.github.com'], filesystem: 'none' as const } },
      { name: 'git', package: 'pypi:mcp-server-git==2026.10.28', args: [], env: [], permissions: { network: [], filesystem: 'read' as const } },
    ],
  },
  files: { 'prompt.md': 'Report at most {{max_findings}} findings.', 'skills/secret-patterns/SKILL.md': '---\nname: secret-patterns\ndescription: d\n---\n# Patterns\nbody' },
};

describe('retrieval layouts', () => {
  it('maps bricks to npx / uvx entries with empty env values', () => {
    expect(mcpEntryFor(pkg.bricks.mcp[0]).entry).toEqual({ command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem@2.1.0', '.'], env: {} });
    expect(mcpEntryFor(pkg.bricks.mcp[1]).entry.env).toEqual({ GITHUB_PERSONAL_ACCESS_TOKEN: '' });
    expect(mcpEntryFor(pkg.bricks.mcp[2]).entry).toEqual({ command: 'uvx', args: ['mcp-server-git==2026.10.28'], env: {} });
  });

  it('claude: subagent file, skills copied, prompt rendered with defaults', () => {
    const l = buildLayout(pkg, 'claude');
    expect(l.files.map((f) => f.path)).toEqual(['.claude/agents/secret-hunter.md', '.claude/skills/secret-patterns/SKILL.md']);
    expect(l.files[0].content.startsWith('---\nname: secret-hunter\ndescription: "Finds leaked secrets."\n---')).toBe(true);
    expect(l.files[0].content).toContain('Report at most 10 findings.');
    expect(l.files[0].content).toContain('.claude/skills/secret-patterns/SKILL.md');
    expect(l.mcpConfigPath).toBe('.mcp.json');
    expect(l.mcp).toHaveLength(3);
  });

  it('cursor: one rule with the skills inlined, frontmatter stripped', () => {
    const l = buildLayout(pkg, 'cursor');
    expect(l.files).toHaveLength(1);
    expect(l.files[0].path).toBe('.cursor/rules/secret-hunter.mdc');
    expect(l.files[0].content).toContain('## Skill: secret-patterns');
    expect(l.files[0].content).not.toContain('description: d');
    expect(l.mcpConfigPath).toBe('.cursor/mcp.json');
  });

  it('copy prompt points at the package URL and embeds no author text', () => {
    const p = copyPrompt('secret-hunter', 'cursor', 'https://agenthive.sh');
    expect(p).toContain('https://agenthive.sh/agents/secret-hunter/package.json');
    expect(p).toContain('layouts.cursor.files');
    expect(p).not.toContain('Report at most');
  });

  it('renderPrompt leaves unknown placeholders alone', () => {
    expect(renderPrompt('a {{x}} b', [])).toBe('a {{x}} b');
  });
});
