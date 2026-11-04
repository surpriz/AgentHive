import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Incidental, Taxonomy, Truth } from './score.js';

export interface TaskMeta {
  id: string;
  stack: string;
  /** false for the rotating private set: traces and outputs are redacted before leaving the runner. */
  public?: boolean;
  /** The goal input handed to the agent, `path` relative to the app root. */
  input: Record<string, unknown>;
  tags?: string[];
}

export interface LoadedTask {
  dir: string;
  meta: TaskMeta;
  truth: Truth;
  incidental: Incidental[];
}

const readJson = async <T>(file: string, fallback: T): Promise<T> => {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw err;
  }
};

export async function loadTask(dir: string): Promise<LoadedTask> {
  const meta = parseYaml(await readFile(path.join(dir, 'task.yaml'), 'utf8')) as TaskMeta;
  const truth = await readJson<Truth | null>(path.join(dir, 'truth.json'), null);
  if (!truth) throw new Error(`${dir}/truth.json missing`);
  const incidental = await readJson<Incidental[]>(path.join(dir, 'incidental.json'), []);
  return { dir, meta, truth, incidental };
}

export async function loadTaxonomy(file: string): Promise<Taxonomy> {
  return parseYaml(await readFile(file, 'utf8')) as Taxonomy;
}

/** A fresh copy of the task's app in a temporary directory, so a run can never touch the checked-in files. */
export async function stageApp(task: LoadedTask): Promise<{ dir: string; cleanup(): Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), `agenthive-${task.meta.id}-`));
  await cp(path.join(task.dir, 'app'), dir, { recursive: true });
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}
