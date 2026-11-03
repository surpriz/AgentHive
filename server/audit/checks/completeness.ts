import type { Check, Finding } from '../types';
import { FORKABLE_LICENSES, isV2 } from '../../manifest';

export const completenessCheck: Check = {
  id: 'completeness',
  network: false,
  async run({ manifest: m, files }) {
    const f: Finding[] = [];
    const low = (message: string, hint?: string) => f.push({ check: 'completeness', severity: 'low', message, hint });
    if (Object.keys(m.spec.io.input).length === 0) low('no input schema', 'Describe spec.io.input as JSON schema.');
    if (Object.keys(m.spec.io.output).length === 0) low('no output schema');
    if (m.readme.trim().length < 200) low('README shorter than 200 characters');
    if (m.useCases.length === 0) low('no use cases listed');
    if (m.metadata.tags.length === 0) low('no tags');
    if (isV2(m)) {
      if (!(FORKABLE_LICENSES as readonly string[]).includes(m.metadata.license)) low(`license ${m.metadata.license} does not allow forks`, `Use one of ${FORKABLE_LICENSES.join(', ')} so others can remix the agent.`);
      const examples = Object.keys(files ?? {}).filter((p) => p.startsWith('examples/')).length;
      if (m.spec.tests.length === 0 && examples === 0) low('no tests and no examples', 'Add spec.tests or an examples/ file so the card can show what the agent does.');
      if (m.spec.bricks.skills.length === 0 && m.spec.bricks.mcp.length === 0) low('no bricks: the agent is a bare prompt');
      return { findings: f };
    }
    if (m.metadata.license === 'UNLICENSED') low('no license declared');
    if (m.spec.tools.length === 0) low('no tools declared');
    if (m.spec.capabilities.length === 0) low('no capabilities declared');
    return { findings: f };
  },
};
