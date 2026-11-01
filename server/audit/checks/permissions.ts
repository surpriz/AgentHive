import type { Check, Finding } from '../types';

const HOST_RE = /^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/i;

export const permissionsCheck: Check = {
  id: 'permissions',
  network: false,
  async run(manifest) {
    const p = manifest.spec.permissions;
    if (!p) {
      return {
        findings: [{ check: 'permissions', severity: 'medium', message: 'no permissions declared', hint: 'Add spec.permissions (network, filesystem, shell, env) so users know what the agent touches.' }],
        caps: [{ grade: 'A', reason: 'permissions not declared' }],
      };
    }
    const findings: Finding[] = [];
    if (p.shell) findings.push({ check: 'permissions', severity: 'medium', message: 'agent declares shell access' });
    if (p.filesystem === 'write') findings.push({ check: 'permissions', severity: 'low', message: 'agent declares filesystem write access' });
    if (p.network.includes('*')) findings.push({ check: 'permissions', severity: 'medium', message: 'agent declares unrestricted network egress', hint: 'List the hosts it actually calls.' });
    const badHosts = p.network.filter((h) => h !== '*' && !HOST_RE.test(h));
    if (badHosts.length) findings.push({ check: 'permissions', severity: 'low', message: `network entries are not hostnames: ${badHosts.slice(0, 3).join(', ')}` });
    return { findings };
  },
};
