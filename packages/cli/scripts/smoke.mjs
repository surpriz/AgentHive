// Runs the built CLI against a registry. Usage: AGENTHIVE_REGISTRY=http://localhost:5173 node scripts/smoke.mjs
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const x = promisify(execFile);
const bin = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'bin.js');
const cli = async (...args) => {
  try {
    const r = await x(process.execPath, [bin, ...args], { env: { ...process.env, NO_COLOR: '1' } });
    return { code: 0, ...r };
  } catch (e) {
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
};
const show = (label, r) => console.log(`${label} [exit ${r.code}]\n${(r.stdout || r.stderr).trim().split('\n').slice(0, 4).join('\n')}\n`);

show('search sql', await cli('search', 'sql'));
show('search --grade AAA --category "Security & Audit"', await cli('search', '-g', 'AAA', '-c', 'Security & Audit'));
show('search nothing', await cli('search', 'zzzz'));
show('info', await cli('info', 'pg-query-optimizer'));
show('manifest', await cli('manifest', 'eu-ai-act-auditor'));
const dir = await mkdtemp(path.join(tmpdir(), 'agenthive-cli-'));
const file = path.join(dir, '.claude.json');
show('add --dry-run', await cli('add', 'dbforge/pg-query-optimizer@3.0.4', '--path', file, '--dry-run'));
show('add (write)', await cli('add', 'pg-query-optimizer', '--path', file));
show('setup (write)', await cli('setup', '--path', file));
const written = JSON.parse(await readFile(file, 'utf8'));
console.log('config servers:', Object.keys(written.mcpServers).join(', '), '\n');
show('add unknown', await cli('add', 'nope'));
show('serve', await cli('serve', 'pg-query-optimizer'));
show('--print cursor', await cli('add', 'pg-query-optimizer', '--print', '--target', 'cursor'));
