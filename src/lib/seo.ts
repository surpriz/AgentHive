import type { Agent } from '../types';

export const SITE_ORIGIN = 'https://agenthive.sh';

export interface PageMeta {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  url: string;
}

export function agentMeta(a: Agent, origin = SITE_ORIGIN): PageMeta {
  return {
    title: `${a.name} · agenthive.sh`,
    description: `${a.value} ${a.framework} · ${a.category} · grade ${a.grade} · ${a.successRate}% success.`,
    ogTitle: `${a.name} — ${a.value}`,
    ogDescription: `${a.tagline} Built with ${a.framework}, security grade ${a.grade}. Install in one command from agenthive.sh.`,
    url: `${origin}/agents/${a.name}`,
  };
}

/** Schema.org description of an agent, for rich results. */
export function agentJsonLd(a: Agent, origin = SITE_ORIGIN) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: a.name,
    description: a.value,
    applicationCategory: 'DeveloperApplication',
    softwareVersion: a.version,
    url: `${origin}/agents/${a.name}`,
    author: { '@type': 'Organization', name: a.author },
    license: a.license,
    datePublished: a.publishedAt,
    offers: { '@type': 'Offer', price: a.costPerRun, priceCurrency: 'USD', description: 'average cost per run' },
    keywords: a.tags.join(', '),
  };
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function setMeta(html: string, attr: 'name' | 'property', key: string, value: string): string {
  const re = new RegExp(`(<meta\\s+${attr}="${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s+content=")[^"]*(")`);
  if (!re.test(html)) throw new Error(`index.html has no <meta ${attr}="${key}">`);
  return html.replace(re, `$1${escapeAttr(value)}$2`);
}

/**
 * Rewrites the built index.html for one agent so crawlers that do not run
 * JavaScript (Twitter, LinkedIn, Slack) see per-agent title, description and
 * Open Graph tags. The SPA still hydrates on top and owns the page afterwards.
 */
export function renderAgentHtml(template: string, a: Agent, origin = SITE_ORIGIN): string {
  const m = agentMeta(a, origin);
  let html = template;
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeText(m.title)}</title>`);
  html = html.replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/, `$1${escapeAttr(m.url)}$2`);
  html = setMeta(html, 'name', 'description', m.description);
  html = setMeta(html, 'property', 'og:title', m.ogTitle);
  html = setMeta(html, 'property', 'og:description', m.ogDescription);
  html = setMeta(html, 'property', 'og:url', m.url);
  html = setMeta(html, 'name', 'twitter:title', m.ogTitle);
  html = setMeta(html, 'name', 'twitter:description', m.ogDescription);
  const ld = `<script type="application/ld+json">${JSON.stringify(agentJsonLd(a, origin)).replace(/</g, '\\u003c')}</script>`;
  html = html.replace('</head>', `    ${ld}\n  </head>`);
  return html;
}
