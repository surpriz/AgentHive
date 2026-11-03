import type { Check, Finding } from '../types';

/** Patterns with low false-positive rates: prefixes that only ever appear in real credentials. */
const PATTERNS: { name: string; re: RegExp }[] = [
  { name: 'AWS access key id', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'GitHub token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{22,}\b/ },
  { name: 'OpenAI API key', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/ },
  { name: 'Anthropic API key', re: /\bsk-ant-[A-Za-z0-9_-]{32,}\b/ },
  { name: 'Slack token', re: /\bxox[abprs]-[0-9A-Za-z-]{10,}\b/ },
  { name: 'Stripe live key', re: /\b(?:sk|rk)_live_[0-9a-zA-Z]{20,}\b/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'private key block', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY(?: BLOCK)?-----/ },
  { name: 'JSON web token', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { name: 'credentials in URL', re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@[^\s/]+/i },
  { name: 'AgentHive API key', re: /\bah_[A-Za-z0-9]{32,}\b/ },
];

export function findSecrets(text: string, where = 'the manifest'): Finding[] {
  const out: Finding[] = [];
  for (const p of PATTERNS) {
    if (p.re.test(text)) {
      out.push({ check: 'secrets', severity: 'blocker', message: `${p.name} found in ${where}`, hint: 'Remove it, rotate it, and pass secrets through env at runtime instead.' });
    }
  }
  return out;
}

export const secretsCheck: Check = {
  id: 'secrets',
  network: false,
  async run({ manifest, files }) {
    const findings = findSecrets(JSON.stringify(manifest));
    for (const [path, text] of Object.entries(files ?? {})) findings.push(...findSecrets(text, path));
    return { findings };
  },
};
