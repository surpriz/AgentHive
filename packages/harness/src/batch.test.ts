import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { planBatch, recordFileName } from './batch.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

describe('batch', () => {
  it('plans every package against every task, with filters', async () => {
    const all = await planBatch(path.join(root, 'agents'), path.join(root, 'trials/code-audit/tasks'), { 'claude-haiku-5-5': 3 });
    expect(all.packages.length).toBeGreaterThanOrEqual(15);
    // The code-audit trial runs code-audit packages only; text agents (growth, writing...) stay out of its batch.
    const audit = await planBatch(path.join(root, 'agents'), path.join(root, 'trials/code-audit/tasks'), { m: 1 }, { goal: 'code-audit' });
    expect(audit.packages.length).toBe(15);
    expect(audit.packages.every((p) => p.goal === 'code-audit')).toBe(true);
    expect(all.packages.length).toBeGreaterThan(audit.packages.length);
    expect(all.tasks.length).toBeGreaterThanOrEqual(5);
    expect(all.tasks[0].meta.id).toBe('t01-nextjs-supabase-notes');
    const some = await planBatch(path.join(root, 'agents'), path.join(root, 'trials/code-audit/tasks'), { m: 1 }, { packages: ['secret-exposure-hunter'], tasks: ['t02-express-prisma-shop'] });
    expect(some.packages.map((p) => p.name)).toEqual(['secret-exposure-hunter']);
    expect(some.tasks).toHaveLength(1);
    const withMissing = await planBatch(path.join(root, 'agents'), [path.join(root, 'trials/code-audit/tasks'), path.join(root, 'nope')], { m: 1 });
    expect(withMissing.tasks.length).toBe(all.tasks.length);
  });

  it('names records so a directory sorts by task, package and model', () => {
    expect(recordFileName({ task: { id: 't01', version: 1, stack: 's' }, package: { name: 'p', version: '1', author: 'a' }, model: 'm', runIndex: 2 })).toBe('t01--p--m--2.json');
  });
});
