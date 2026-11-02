import { describe, expect, it } from 'vitest';
import { exampleInputFor, sampleFromSchema } from './exampleInput';

describe('exampleInputFor', () => {
  it('prefers the author test input', () => {
    expect(exampleInputFor({ exampleInput: { expression: '*/5 * * * *' }, inputSchema: { type: 'object', properties: { x: { type: 'string' } } } })).toEqual({ expression: '*/5 * * * *' });
  });

  it('falls back to the required schema properties', () => {
    const inputSchema = {
      type: 'object',
      required: ['repo', 'pr'],
      properties: { repo: { type: 'string', description: 'owner/name' }, pr: { type: 'integer' }, max_findings: { type: 'integer', default: 10 } },
    };
    expect(exampleInputFor({ exampleInput: null, inputSchema })).toEqual({ repo: '<owner/name>', pr: 1 });
  });

  it('uses every property when nothing is required, honouring defaults, enums and examples', () => {
    const inputSchema = {
      type: 'object',
      properties: {
        timezone: { type: 'string', default: 'UTC' },
        focus: { type: 'array', items: { enum: ['correctness', 'security'] } },
        query: { type: 'string', examples: ['select 1'] },
        flag: { type: 'boolean' },
      },
    };
    expect(exampleInputFor({ exampleInput: undefined, inputSchema })).toEqual({ timezone: 'UTC', focus: ['correctness'], query: 'select 1', flag: false });
  });

  it('keeps a generic task when the schema says nothing useful', () => {
    expect(exampleInputFor({ inputSchema: {} })).toEqual({ task: 'hello' });
    expect(exampleInputFor({ inputSchema: { type: 'string' } })).toEqual({ task: 'hello' });
  });

  it('stops recursing on deep schemas', () => {
    const deep: Record<string, unknown> = { type: 'object', properties: {} };
    let node = deep;
    for (let i = 0; i < 6; i++) {
      const next: Record<string, unknown> = { type: 'object', properties: {} };
      (node.properties as Record<string, unknown>)[`l${i}`] = next;
      node = next;
    }
    expect(sampleFromSchema(deep, 0)).toEqual({ l0: { l1: { l2: {} } } });
  });
});
