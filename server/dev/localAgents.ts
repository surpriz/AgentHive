import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { Db } from '../db/client';
import type { AuditContext } from '../audit/types';
import { parseManifest, validatePackageFiles, isV2, type PackageFiles } from '../manifest';
import { publishManifest, type Publisher } from '../publish';

/** The files of a package directory as the publish API expects them: relative posix paths → text. */
export async function readPackageDir(dir: string): Promise<{ manifest: string; files: PackageFiles }> {
  const manifest = await readFile(path.join(dir, 'agent.yaml'), 'utf8');
  const files: PackageFiles = {};
  const walk = async (rel: string) => {
    for (const entry of await readdir(path.join(dir, rel), { withFileTypes: true })) {
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(relPath);
      else if (relPath !== 'agent.yaml') files[relPath] = await readFile(path.join(dir, relPath), 'utf8');
    }
  };
  await walk('');
  return { manifest, files };
}

/**
 * Publishes every package directory under `root` as `who`. Used by local and
 * e2e boots so the catalog shows the real agents of the repository instead of
 * invented ones. Throws on the first invalid package: a broken agent in the
 * repository is a bug, not a runtime condition.
 */
export async function publishLocalAgents(db: Db, who: Publisher, root: string, auditCtx: AuditContext): Promise<string[]> {
  let names: string[];
  try {
    names = (await readdir(root)).sort();
  } catch {
    return [];
  }
  const published: string[] = [];
  for (const name of names) {
    const dir = path.join(root, name);
    if (!(await stat(dir)).isDirectory()) continue;
    const { manifest, files } = await readPackageDir(dir);
    const parsed = parseManifest(manifest);
    if (!parsed.ok) throw new Error(`${dir}/agent.yaml: ${parsed.issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
    if (!isV2(parsed.manifest)) throw new Error(`${dir}/agent.yaml is not a v2 package`);
    const issues = validatePackageFiles(parsed.manifest, files);
    if (issues.length > 0) throw new Error(`${dir}: ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
    const res = await publishManifest(db, who, parsed.manifest, auditCtx, files);
    if (!res.ok) throw new Error(`${dir}: ${res.message}`);
    published.push(res.agent.name);
  }
  return published;
}
