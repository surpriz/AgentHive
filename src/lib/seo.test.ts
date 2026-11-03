import { describe, expect, it } from 'vitest';
import { fixtureAgents as mockAgents } from '../test/fixtures';
import { agentMeta, renderAgentHtml } from './seo';

const template = `<!doctype html><html><head>
<meta name="description" content="home" />
<link rel="canonical" href="https://agenthive.sh/" />
<meta property="og:title" content="home" />
<meta property="og:description" content="home" />
<meta property="og:url" content="https://agenthive.sh/" />
<meta name="twitter:title" content="home" />
<meta name="twitter:description" content="home" />
<title>home</title>
</head><body><div id="root"></div></body></html>`;

const agent = mockAgents.find((a) => a.name === 'pg-query-optimizer')!;

describe('renderAgentHtml', () => {
  it('rewrites title, canonical, description and open graph tags per agent', () => {
    const html = renderAgentHtml(template, agent);
    const m = agentMeta(agent);
    expect(html).toContain(`<title>${m.title}</title>`);
    expect(html).toContain(`<link rel="canonical" href="${m.url}"`);
    expect(html).toContain(`<meta property="og:url" content="${m.url}"`);
    expect(html).toContain(`<meta property="og:title" content="${m.ogTitle}"`);
    expect(html).toContain(`<meta name="twitter:title" content="${m.ogTitle}"`);
    expect(html).not.toContain('content="home"');
  });

  it('adds schema.org json-ld and keeps the app root', () => {
    const html = renderAgentHtml(template, agent);
    expect(html).toContain('"@type":"SoftwareApplication"');
    expect(html).toContain('"name":"pg-query-optimizer"');
    expect(html).toContain('<div id="root"></div>');
  });

  it('escapes quotes and angle brackets in attribute values', () => {
    const nasty = { ...agent, value: 'Uses "quotes" & <tags>' };
    const html = renderAgentHtml(template, nasty);
    expect(html).toContain('Uses &quot;quotes&quot; &amp; &lt;tags>');
    expect(html).not.toContain('content="Uses "quotes"');
  });

  it('throws when the template lacks an expected tag', () => {
    expect(() => renderAgentHtml('<html><head><title>x</title></head></html>', agent)).toThrow(/og:title|description/);
  });

  it('renders every fixture agent against the real index.html', async () => {
    const fs = await import('node:fs');
    const real = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
    for (const a of mockAgents) {
      const html = renderAgentHtml(real, a);
      expect(html).toContain(`/agents/${a.name}`);
    }
  });
});
