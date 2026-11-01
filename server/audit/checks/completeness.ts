import type { Check, Finding } from '../types';

export const completenessCheck: Check = {
  id: 'completeness',
  network: false,
  async run(m) {
    const f: Finding[] = [];
    const low = (message: string, hint?: string) => f.push({ check: 'completeness', severity: 'low', message, hint });
    if (Object.keys(m.spec.io.input).length === 0) low('no input schema', 'Describe spec.io.input as JSON schema.');
    if (Object.keys(m.spec.io.output).length === 0) low('no output schema');
    if (m.readme.trim().length < 200) low('README shorter than 200 characters');
    if (m.useCases.length === 0) low('no use cases listed');
    if (m.metadata.license === 'UNLICENSED') low('no license declared');
    if (m.metadata.tags.length === 0) low('no tags');
    if (m.spec.tools.length === 0) low('no tools declared');
    if (m.spec.capabilities.length === 0) low('no capabilities declared');
    return { findings: f };
  },
};
