import { useEffect, useRef, useState } from 'react';
import { Upload, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { CATEGORIES, FRAMEWORKS } from '../types';
import type { Category, Framework, PublishPayload } from '../types';
import { Modal } from './ui/Modal';

const NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const DEFAULT_MANIFEST = `{
  "apiVersion": "agenthive.sh/v0",
  "kind": "Agent",
  "transport": "mcp/stdio",
  "capabilities": ["example.run"],
  "tools": ["HTTP Client"],
  "io": { "input": "#/schemas/input", "output": "#/schemas/output" }
}`;

type Phase = 'form' | 'pushing' | 'done';

const PUSH_LOG = (name: string, author: string) => [
  { t: 'validating manifest … ok', d: 500 },
  { t: 'resolving framework adapter … ok', d: 600 },
  { t: 'running static security scan (semgrep, 212 rules) … 0 findings', d: 1300 },
  { t: 'checking network egress policy … allowlist', d: 600 },
  { t: 'running smoke benchmark (25 runs) … 24/25 passed', d: 1500 },
  { t: 'assigning security grade … A (provisional, full audit queued)', d: 700 },
  { t: 'generating A2A agent card … ok', d: 500 },
  { t: `pushed → agenthive.sh/${author}/${name}@0.1.0`, d: 400 },
];

export function PublishModal({
  open,
  onClose,
  onPublished,
}: {
  open: boolean;
  onClose: () => void;
  onPublished: (p: PublishPayload) => void;
}) {
  const [phase, setPhase] = useState<Phase>('form');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [framework, setFramework] = useState<Framework>('MCP Server');
  const [category, setCategory] = useState<Category>('DevOps');
  const [manifest, setManifest] = useState(DEFAULT_MANIFEST);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [touched, setTouched] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const timers = useRef<number[]>([]);

  const nameError = !name ? 'Required' : !NAME_RE.test(name) ? 'kebab-case only (a-z, 0-9, dashes)' : null;
  const descError = description.trim().length < 20 ? 'At least 20 characters' : null;
  let manifestError: string | null = null;
  try {
    const parsed = JSON.parse(manifest);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) manifestError = 'Must be a JSON object';
  } catch (e) {
    manifestError = (e as Error).message.replace(/^JSON\.parse: /, '');
  }
  const promptError = systemPrompt.trim().length < 10 ? 'At least 10 characters' : null;
  const valid = !nameError && !descError && !manifestError && !promptError;

  useEffect(() => {
    if (!open) {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      setPhase('form');
      setLog([]);
      setTouched(false);
    }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setPhase('pushing');
    setLog([`$ agent-cli push ./${name}`]);
    let t = 0;
    const lines = PUSH_LOG(name, 'you');
    lines.forEach((l, i) => {
      t += l.d;
      const id = window.setTimeout(() => {
        setLog((prev) => [...prev, l.t]);
        if (i === lines.length - 1) {
          setPhase('done');
          onPublished({ name, description, framework, category, manifest, systemPrompt });
        }
      }, t);
      timers.current.push(id);
    });
  };

  const field = 'w-full rounded-md border bg-[#0c0c0e] px-3 py-2 text-[13px] text-fg placeholder:text-dim focus:outline-none focus:border-accent/60';
  const border = (err: string | null) => (touched && err ? 'border-danger/60' : 'border-border');

  return (
    <Modal open={open} onClose={onClose} title="agent-cli push">
      {phase === 'form' ? (
        <form onSubmit={submit} className="flex flex-1 flex-col overflow-hidden" noValidate>
          <div className="flex-1 space-y-4 overflow-auto p-5">
            <p className="text-[13px] text-muted">
              Publish an agent to the public registry. This simulates <span className="font-mono text-fg">agent-cli push</span>: validation, security scan, smoke benchmark, grade.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" error={touched ? nameError : null} hint="agenthive.sh/you/<name>">
                <input className={`${field} font-mono ${border(nameError)}`} value={name} onChange={(e) => setName(e.target.value.toLowerCase())} placeholder="my-sql-agent" autoComplete="off" />
              </Field>
              <Field label="Framework">
                <select className={`${field} border-border`} value={framework} onChange={(e) => setFramework(e.target.value as Framework)}>
                  {FRAMEWORKS.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category">
                <select className={`${field} border-border`} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Description" error={touched ? descError : null}>
                <input className={`${field} ${border(descError)}`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One line: what it does, for whom" />
              </Field>
            </div>

            <Field label="Manifest (JSON)" error={touched ? manifestError : null} hint="agent.json">
              <textarea className={`${field} font-mono text-[12px] ${border(manifestError)}`} rows={8} value={manifest} onChange={(e) => setManifest(e.target.value)} spellCheck={false} />
            </Field>

            <Field label="System prompt" error={touched ? promptError : null}>
              <textarea className={`${field} font-mono text-[12px] ${border(promptError)}`} rows={4} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="You are an agent that…" />
            </Field>
          </div>

          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <span className="font-mono text-[11px] text-dim">{valid ? 'ready to push' : touched ? 'fix the fields above' : 'fill in the form'}</span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-[13px] text-muted hover:text-fg">
                Cancel
              </button>
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-black hover:bg-accent/90">
                <Upload size={14} /> Push
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-5">
            <pre className="min-h-[260px] whitespace-pre-wrap rounded-lg border border-border bg-[#0c0c0e] p-3 font-mono text-[12px] leading-relaxed text-fg/85" role="log" aria-live="polite">
              {log.map((l, i) => (
                <div key={i} className={`animate-fade-up ${i === 0 ? 'text-muted' : l.startsWith('pushed') ? 'text-ok' : ''}`}>
                  {i === 0 ? l : <><span className="text-dim">▸ </span>{l}</>}
                </div>
              ))}
              {phase === 'pushing' && (
                <div className="mt-1 flex items-center gap-1.5 text-dim">
                  <Loader2 size={12} className="animate-spin" /> working…
                </div>
              )}
            </pre>
          </div>
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-dim">
              {phase === 'done' ? (
                <><CheckCircle2 size={13} className="text-ok" /> published · visible in the grid</>
              ) : (
                <><AlertCircle size={13} className="text-accent" /> do not close the terminal</>
              )}
            </span>
            <button type="button" onClick={onClose} disabled={phase !== 'done'} className="rounded-md border border-border px-3 py-1.5 text-[13px] text-muted hover:text-fg disabled:opacity-50">
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string | null; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between font-mono text-[11px] uppercase tracking-wider text-dim">
        {label}
        {error ? <span className="normal-case tracking-normal text-danger">{error}</span> : hint ? <span className="normal-case tracking-normal text-dim/70">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}
