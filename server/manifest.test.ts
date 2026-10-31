import { describe, expect, it } from 'vitest';
import { compareSemver, parseManifest } from './manifest';

describe('parseManifest', () => {
  it('strips server-owned blocks and applies defaults', () => {
    const r = parseManifest({
      apiVersion: 'agenthive.sh/v1',
      metadata: { name: 'x-bot', version: '1.0.0', category: 'Finance', value: 'Does something useful for finance teams.', tagline: 'A longer technical description.' },
      spec: { framework: 'CrewAI' },
      security: { grade: 'AAA' },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.manifest.spec.transport).toBe('a2a/http+json');
    expect(r.manifest.metadata.license).toBe('UNLICENSED');
    expect('security' in r.manifest).toBe(false);
  });

  it('rejects non-https endpoints and bad yaml', () => {
    const r = parseManifest({ apiVersion: 'agenthive.sh/v1', metadata: { name: 'x-bot', version: '1.0.0', category: 'Finance', value: 'Does something useful for finance teams.', tagline: 'A longer technical description.' }, spec: { framework: 'CrewAI', endpoint: 'http://evil.example' } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0].path).toBe('spec.endpoint');
    expect(parseManifest('a: [').ok).toBe(false);
    expect(parseManifest('- not a mapping').ok).toBe(false);
  });

  it('caps the size', () => {
    expect(parseManifest('x'.repeat(300 * 1024)).ok).toBe(false);
  });
});

describe('compareSemver', () => {
  it('orders releases and pre-releases', () => {
    expect(compareSemver('1.2.0', '1.10.0')).toBeLessThan(0);
    expect(compareSemver('2.0.0', '1.99.99')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('1.0.0', '1.0.0-rc.1')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0-alpha', '1.0.0-beta')).toBeLessThan(0);
  });
});
