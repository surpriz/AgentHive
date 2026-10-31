// Used only by `pnpm auth:schema` (better-auth CLI) to generate server/db/auth-schema.ts.
import { createAuth } from './auth';
import type { Db } from './db/client';

export const auth = createAuth({} as Db, { secret: 'cli-only-not-a-secret-0000000000000000', baseURL: 'http://localhost:5173' });
