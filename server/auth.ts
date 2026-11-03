import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { apiKey } from '@better-auth/api-key';
import type { Db } from './db/client';
import * as authSchema from './db/auth-schema';
import { eq } from 'drizzle-orm';
import { resetMail, verificationMail, type MailSender } from './email';

export interface AuthEnv {
  secret: string;
  baseURL: string;
  github?: { clientId: string; clientSecret: string };
  google?: { clientId: string; clientSecret: string };
  trustedOrigins?: string[];
  /** Email + password sign-in without verification. Only for the in-memory database outside production (local dev, e2e). */
  passwordLogin?: boolean;
  /** Email + password sign-in with a verification link, for deployments with a mail sender. */
  email?: { send: MailSender };
}

export function createAuth(db: Db, env: AuthEnv) {
  // A mail sender turns email sign-in on with a verification link; the dev password login never verifies.
  const verify = Boolean(env.email) && env.passwordLogin !== true;
  return betterAuth({
    appName: 'agenthive.sh',
    secret: env.secret,
    baseURL: env.baseURL,
    basePath: '/api/auth',
    trustedOrigins: env.trustedOrigins,
    database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),
    emailAndPassword: {
      enabled: env.passwordLogin === true || Boolean(env.email),
      requireEmailVerification: verify,
      // With verification on, the automatic sign-in after sign-up would fail and send the link a second time.
      autoSignIn: !verify,
      ...(env.email ? { sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => env.email!.send(resetMail(user.email, url)) } : {}),
    },
    ...(env.email
      ? {
          emailVerification: {
            sendOnSignUp: verify,
            autoSignInAfterVerification: true,
            sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => env.email!.send(verificationMail(user.email, url)),
          },
        }
      : {}),
    socialProviders: {
      ...(env.github
        ? {
            github: {
              clientId: env.github.clientId,
              clientSecret: env.github.clientSecret,
              mapProfileToUser: (profile) => ({ login: profile.login }),
            },
          }
        : {}),
      ...(env.google
        ? {
            google: {
              clientId: env.google.clientId,
              clientSecret: env.google.clientSecret,
              // Google has no handle: the login (author and owner namespace) comes from the email's local part.
              mapProfileToUser: (profile) => ({ login: loginFromEmail(profile.email) }),
            },
          }
        : {}),
    },
    databaseHooks: {
      user: {
        create: {
          // Every account needs a unique login: it is the author shown on cards and, with v2, the owner namespace.
          before: async (u) => {
            const current = (u as Record<string, unknown>).login;
            const wanted = typeof current === 'string' && current ? current : loginFromEmail(u.email);
            return { data: { ...u, login: await uniqueLogin(db, wanted) } };
          },
        },
      },
    },
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

const LOGIN_RE = /[^a-z0-9-]/g;

/** `jane.doe+x@example.com` → `jane-doe`. Same character set as GitHub logins. */
export function loginFromEmail(email: string | undefined): string {
  const local = (email ?? 'user').split('@')[0].split('+')[0].toLowerCase().replace(LOGIN_RE, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return local.length >= 2 ? local.slice(0, 39) : `user-${local}`;
}

/** Logins nobody can take: registry names, system callers and words that would read as official. */
export const RESERVED_LOGINS = new Set(['agenthive', 'agenthive-sh', 'system', 'system-benchmark', 'agenthive-benchmark', 'admin', 'root', 'api', 'docs', 'support', 'security', 'staff', 'official', 'registry', 'www']);

/** Appends -2, -3… until the login is free. Reserved names are never handed out. The unique index on user.login is the backstop. */
export async function uniqueLogin(db: Db, wanted: string): Promise<string> {
  const base = wanted.slice(0, 36);
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? base : `${base}-${i}`;
    if (RESERVED_LOGINS.has(candidate)) continue;
    const taken = await db.query.user.findFirst({ where: eq(authSchema.user.login, candidate) });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
