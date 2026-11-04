import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { planBatch, recordFileName } from './batch.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');

describe('batch', () => {
  it('plans every package against every task, with filters', async () => {
    const all = await planBatch(path.join(root, 'agents'), path.join(root, 'trials/code-audit/tasks'), { 'claude-haiku-5-5': 3 });
    expect(all.packages.length).toBe(5);
    expect(all.tasks.map((t) => t.meta.id)).toEqual(['t01-nextjs-supabase-notes', 't02-express-prisma-shop']);
    const some = await planBatch(path.join(root, 'agents'), path.join(root, 'trials/code-audit/tasks'), { m: 1 }, { packages: ['secret-exposure-hunter'], tasks: ['t02-express-prisma-shop'] });
    expect(some.packages.map((p) => p.name)).toEqual(['secret-exposure-hunter']);
    expect(some.tasks).toHaveLength(1);
  });

  it('names records so a directory sorts by task, package and model', () => {
    expect(recordFileName({ task: { id: 't01', version: 1, stack: 's' }, package: { name: 'p', version: '1', author: 'a' }, model: 'm', runIndex: 2 })).toBe('t01--p--m--2.json');
  });
});
