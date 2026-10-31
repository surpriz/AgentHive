import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as agentSchema from './schema';
import * as authSchema from './auth-schema';

export const schema = { ...agentSchema, ...authSchema };
export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

export const PGLITE_URL = 'pglite://memory';

/**
 * One factory, two drivers:
 *   postgresql://…  → Neon over HTTP (works in Vercel functions and Node)
 *   pglite://memory → in-process Postgres for tests, CI and offline dev
 */
export async function createDb(databaseUrl: string): Promise<{ db: Db; migrate: () => Promise<void> }> {
  if (databaseUrl.startsWith('pglite://')) {
    // Module names kept in variables so the Vercel function bundler does not trace PGlite (dev/test only).
    const [pgliteMod, drizzleMod, migratorMod] = ['@electric-sql/pglite', 'drizzle-orm/pglite', 'drizzle-orm/pglite/migrator'];
    const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
      import(/* @vite-ignore */ pgliteMod) as Promise<typeof import('@electric-sql/pglite')>,
      import(/* @vite-ignore */ drizzleMod) as Promise<typeof import('drizzle-orm/pglite')>,
      import(/* @vite-ignore */ migratorMod) as Promise<typeof import('drizzle-orm/pglite/migrator')>,
    ]);
    const client = new PGlite();
    const db = drizzle(client, { schema, casing: 'snake_case' });
    return { db: db as unknown as Db, migrate: () => migrate(db, { migrationsFolder: migrationsFolder() }) };
  }
  const [{ neon }, { drizzle }, { migrate }] = await Promise.all([
    import('@neondatabase/serverless'),
    import('drizzle-orm/neon-http'),
    import('drizzle-orm/neon-http/migrator'),
  ]);
  const db = drizzle(neon(databaseUrl), { schema, casing: 'snake_case' });
  return { db: db as unknown as Db, migrate: () => migrate(db, { migrationsFolder: migrationsFolder() }) };
}

function migrationsFolder(): string {
  return new URL('./migrations', import.meta.url).pathname;
}
