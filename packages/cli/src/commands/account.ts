import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import type { Command } from 'commander';
import { RegistryClient, RegistryError, type AuditReport } from '@agenthive-sh/registry-client';
import { clearCredentials, credentialsPath, writeCredentials } from '../credentials.js';
import { c, gradeColor, sanitize } from '../ui.js';

async function promptSecret(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

const SEV = { blocker: (s: string) => c.red(s), high: (s: string) => c.red(s), medium: (s: string) => c.yellow(s), low: (s: string) => c.dim(s) };

export function printAudit(a: AuditReport): void {
  if (a.illustrative) return console.log(c.dim('  illustrative seed grade, no audit'));
  for (const cap of a.caps) console.log(`  ${c.yellow('cap ' + cap.grade)} ${sanitize(cap.reason)}`);
  if (a.findings.length === 0) console.log(c.dim('  no findings'));
  for (const f of a.findings) console.log(`  ${SEV[f.severity](f.severity.padEnd(7))} ${sanitize(f.check)}: ${sanitize(f.message)}${f.hint ? c.dim(` — ${sanitize(f.hint)}`) : ''}`);
}

export function registerAccount(program: Command, client: () => Promise<RegistryClient>, baseUrl: () => string) {
  program
    .command('run <name>')
    .description('call an agent through the gateway (signed, logged, quota-limited) and print its JSON answer')
    .option('-i, --input <json>', 'JSON input (default: read stdin)')
    .option('-f, --input-file <file>', 'read the JSON input from a file')
    .action(async (name: string, opts: { input?: string; inputFile?: string }) => {
      let raw = opts.input;
      if (opts.inputFile) raw = await readFile(opts.inputFile, 'utf8');
      if (raw === undefined) {
        if (process.stdin.isTTY) throw new Error('give the input with --input, --input-file, or pipe it on stdin');
        raw = await new Promise<string>((resolve) => {
          let buf = '';
          process.stdin.setEncoding('utf8').on('data', (d) => (buf += d)).on('end', () => resolve(buf));
        });
      }
      let input: unknown;
      try {
        input = JSON.parse(raw);
      } catch (e) {
        throw new Error(`input is not valid JSON: ${(e as Error).message}`);
      }
      const res = await (await client()).run(name, input);
      console.error(c.dim(`run ${res.runId} · upstream ${res.status} · ${res.latencyMs}ms`));
      console.log(typeof res.output === 'string' ? sanitize(res.output) : JSON.stringify(res.output, null, 2));
      if (res.status >= 400) process.exitCode = 1;
    });

  program
    .command('runs [name]')
    .description('your recent gateway calls, or the calls received by an agent you own')
    .option('--json', 'raw log')
    .action(async (name: string | undefined, opts: { json?: boolean }) => {
      const list = await (await client()).runs(name);
      if (opts.json) return console.log(JSON.stringify(list, null, 2));
      if (list.length === 0) return console.log(c.dim('no runs yet'));
      const rows = list.map((r) => [
        r.createdAt.slice(0, 19).replace('T', ' '),
        sanitize(name ? r.callerLogin : r.agentName),
        r.status === 'ok' ? c.green(r.status) : c.red(r.status),
        r.httpStatus === null ? '—' : String(r.httpStatus),
        `${r.latencyMs}ms`,
        c.dim(sanitize(r.error ?? '').slice(0, 50)),
      ]);
      const { table } = await import('../ui.js');
      console.log(table(rows, ['WHEN', name ? 'CALLER' : 'AGENT', 'STATUS', 'HTTP', 'LATENCY', 'ERROR']));
    });

  program
    .command('audit <name>')
    .description('show the registry audit report behind an agent grade (see agenthive.sh/docs/grading)')
    .option('--rerun', 're-run the audit on your own agent (once per hour)')
    .option('--json', 'raw report')
    .action(async (name: string, opts: { rerun?: boolean; json?: boolean }) => {
      if (opts.rerun) {
        const { audit } = await (await client()).rerunAudit(name);
        if (opts.json) return console.log(JSON.stringify(audit, null, 2));
        console.log(`${c.bold(sanitize(name))} ${gradeColor(audit.blocked ? 'B' : audit.grade)} ${c.dim(`${audit.score}/100 · ${audit.auditedAt.slice(0, 10)}`)}`);
        return printAudit(audit);
      }
      const res = await new RegistryClient({ baseUrl: baseUrl() }).audit(name);
      if (opts.json) return console.log(JSON.stringify(res, null, 2));
      console.log(`${c.bold(sanitize(res.agent))}@${sanitize(res.version)} ${gradeColor(sanitize(String(res.grade)))} ${c.dim(res.score === null ? 'pending' : `${res.score}/100`)}`);
      if (!res.report) return console.log(c.dim('  no audit yet'));
      printAudit(res.report);
    });

  program
    .command('login')
    .description('store an API key for this registry (create one in your dashboard)')
    .option('-k, --key <key>', 'API key; prompted if omitted')
    .action(async (opts: { key?: string }) => {
      const registry = baseUrl();
      const key = opts.key ?? (await promptSecret(`API key for ${registry} (from ${registry}/dashboard): `));
      if (!key) throw new Error('no key given');
      const me = await new RegistryClient({ baseUrl: registry, token: key }).me();
      await writeCredentials({ registry, token: key, login: me.user.login });
      console.log(`${c.green('✓')} logged in as ${c.bold(sanitize(me.user.login))} · saved to ${credentialsPath()}`);
    });

  program
    .command('logout')
    .description('forget the stored API key')
    .action(async () => {
      await clearCredentials();
      console.log(`${c.green('✓')} credentials removed`);
    });

  program
    .command('whoami')
    .description('show the account behind the current API key')
    .action(async () => {
      const me = await (await client()).me();
      console.log(`${c.bold(sanitize(me.user.login))} ${c.dim(`via ${me.via}`)}`);
      if (me.agents.length === 0) return console.log(c.dim('no agents published yet · agent-cli push ./agent.yaml'));
      for (const a of me.agents) console.log(`  ${sanitize(a.name)} ${c.dim(`v${sanitize(a.version)}`)} ${gradeColor(sanitize(a.grade))}`);
    });

  program
    .command('push [file]')
    .description('publish a manifest (agent.yaml by default) to the registry')
    .action(async (file = 'agent.yaml') => {
      let manifest: string;
      try {
        manifest = await readFile(file, 'utf8');
      } catch (e) {
        throw new Error(`cannot read ${file}: ${(e as Error).message}`);
      }
      try {
        const res = await (await client()).publish(manifest);
        console.log(`${c.green('✓')} published ${c.bold(sanitize(res.agent.name))}@${sanitize(res.agent.version)} as ${sanitize(res.agent.author)} ${gradeColor(sanitize(res.agent.grade))} ${c.dim(`${res.audit.score}/100`)}`);
        console.log(`  ${sanitize(res.url)}`);
        printAudit(res.audit);
        console.log(c.dim(`  install: agent-cli add ${sanitize(res.agent.name)}`));
      } catch (e) {
        if (e instanceof RegistryError && e.audit) {
          console.error(`${c.red('✗')} publish refused by the audit:`);
          printAudit(e.audit);
          process.exitCode = 1;
          return;
        }
        if (e instanceof RegistryError && e.issues) {
          console.error(`${c.red('✗')} ${file} is not a valid manifest:`);
          for (const i of e.issues) console.error(`  ${c.yellow(sanitize(i.path) || 'manifest')}: ${sanitize(i.message)}`);
          process.exitCode = 1;
          return;
        }
        throw e;
      }
    });
}
