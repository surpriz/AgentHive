// Applies server/db/migrations to DATABASE_URL. Used by `pnpm db:migrate` and the Vercel build.
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';

const url = process.env.DATABASE_URL;
if (!url || url.startsWith('pglite://')) {
  console.log('db:migrate skipped (no DATABASE_URL or pglite)');
  process.exit(0);
}
const db = drizzle(neon(url));
await migrate(db, { migrationsFolder: new URL('../server/db/migrations', import.meta.url).pathname });
console.log('db:migrate ok');
