import type { Check, CheckResult, Finding } from '../types';
import { isV2 } from '../../manifest';

const SHEBANG = /^#![^\n]*$/m;
/** A fenced block that pipes a download into a shell: the pattern of most supply-chain skills. */
const PIPE_TO_SHELL = /\b(curl|wget)\b[^\n]*\|\s*(sudo\s+)?(ba|z)?sh\b/;

/** v2 packages are text. This check names anything in them that reads like an executable or an install one-liner. */
export const scriptsCheck: Check = {
  id: 'scripts',
  network: false,
  async run({ manifest, files }): Promise<CheckResult> {
    if (!isV2(manifest)) return { findings: [], skipped: 'hosted agent' };
    const findings: Finding[] = [];
    for (const [path, text] of Object.entries(files ?? {})) {
      if (SHEBANG.test(text)) findings.push({ check: 'scripts', severity: 'medium', message: `${path} contains a shebang line`, hint: 'Packages are instructions, not programs. Move executable code into an MCP server.' });
      if (PIPE_TO_SHELL.test(text)) findings.push({ check: 'scripts', severity: 'high', message: `${path} pipes a download into a shell`, hint: 'Never ask the user\'s tool to run remote scripts.' });
    }
    return { findings };
  },
};
