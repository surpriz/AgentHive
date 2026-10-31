import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { apiKey } from '@better-auth/api-key';
import type { Db } from './db/client';
import * as authSchema from './db/auth-schema';

export interface AuthEnv {
  secret: string;
  baseURL: string;
  github?: { clientId: string; clientSecret: string };
  trustedOrigins?: string[];
  /** Email + password sign-in. Only enabled for the in-memory database outside production (local dev, e2e). */
  passwordLogin?: boolean;
}

export function createAuth(db: Db, env: AuthEnv) {
  return betterAuth({
    appName: 'agenthive.sh',
    secret: env.secret,
    baseURL: env.baseURL,
    basePath: '/api/auth',
    trustedOrigins: env.trustedOrigins,
    database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
    emailAndPassword: { enabled: env.passwordLogin === true },
    socialProviders: env.github
      ? {
          github: {
            clientId: env.github.clientId,
            clientSecret: env.github.clientSecret,
            mapProfileToUser: (profile) => ({ login: profile.login }),
          },
        }
      : {},
    user: {
      additionalFields: {
        login: { type: 'string', required: false, input: false },
      },
    },
    session: {
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    plugins: [
      apiKey({
        defaultPrefix: 'ah_',
        apiKeyHeaders: 'x-api-key',
        rateLimit: { enabled: true, timeWindow: 60_000, maxRequests: 120 },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
