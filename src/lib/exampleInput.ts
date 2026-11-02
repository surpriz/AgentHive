import type { Agent } from '../types';

type Schema = Record<string, unknown>;

/**
 * A ready-to-edit input for the Run tab: the author's first test case when the manifest
 * declares one, otherwise a sample built from the JSON schema (required properties, or all
 * of them when none is required), otherwise a generic task.
 */
export function exampleInputFor(agent: Pick<Agent, 'exampleInput' | 'inputSchema'>): Record<string, unknown> {
  if (agent.exampleInput && typeof agent.exampleInput === 'object' && Object.keys(agent.exampleInput).length > 0) return agent.exampleInput;
  const fromSchema = sampleFromSchema(agent.inputSchema, 0);
  if (fromSchema && typeof fromSchema === 'object' && !Array.isArray(fromSchema) && Object.keys(fromSchema).length > 0) return fromSchema as Record<string, unknown>;
  return { task: 'hello' };
}

/** Builds a plausible value for a JSON-schema node. Shallow on purpose: three levels, no $ref. */
export function sampleFromSchema(schema: unknown, depth: number): unknown {
  if (!schema || typeof schema !== 'object' || depth > 3) return undefined;
  const s = schema as Schema;
  if (Array.isArray(s.examples) && s.examples.length > 0) return s.examples[0];
  if ('default' in s && s.default !== undefined) return s.default;
  if ('const' in s) return s.const;
  if (Array.isArray(s.enum) && s.enum.length > 0) return s.enum[0];
  const type = Array.isArray(s.type) ? s.type[0] : s.type;
  if (type === 'object' || (type === undefined && s.properties)) {
    const props = (s.properties ?? {}) as Record<string, unknown>;
    const required = Array.isArray(s.required) ? (s.required as string[]) : [];
    const keys = required.length > 0 ? required.filter((k) => k in props) : Object.keys(props);
    const out: Record<string, unknown> = {};
    for (const k of keys) {
      const v = sampleFromSchema(props[k], depth + 1);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  if (type === 'array') {
    const item = sampleFromSchema(s.items, depth + 1);
    return item === undefined ? [] : [item];
  }
  if (type === 'string') return typeof s.description === 'string' && s.description.length <= 60 ? `<${s.description}>` : 'string';
  if (type === 'integer') return typeof s.minimum === 'number' ? s.minimum : 1;
  if (type === 'number') return typeof s.minimum === 'number' ? s.minimum : 1;
  if (type === 'boolean') return false;
  if (type === 'null') return null;
  return undefined;
}
