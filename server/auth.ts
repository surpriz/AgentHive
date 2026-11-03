import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { apiKey } from '@better-auth/api-key';
import type { Db } from './db/client';
import * as authSchema from './db/auth-schema';
import { and, eq, lt } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
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
      // A reset is how the real owner evicts anyone who knew the old password: every session goes, and so do the API keys minted under it.
      revokeSessionsOnPasswordReset: true,
      onPasswordReset: async ({ user }: { user: { id: string } }) => {
        await db.delete(authSchema.apikey).where(eq(authSchema.apikey.referenceId, user.id));
      },
      ...(env.email ? { sendResetPassword: async ({ user, url }: { user: { email: string }; url: string }) => env.email!.send(resetMail(user.email, url)) } : {}),
    },
    ...(env.email
      ? {
          emailVerification: {
            sendOnSignUp: verify,
            // Whoever opens the link must still know the password: a stranger who signed up with this address first gets nothing out of the owner's click.
            autoSignInAfterVerification: false,
            sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => env.email!.send(verificationMail(user.email, url)),
            // The handle becomes claimable only once the mailbox is proven, and nothing that existed before survives.
            afterEmailVerification: async (user: { id: string; email: string; login?: string | null }) => {
              await db.delete(authSchema.session).where(eq(authSchema.session.userId, user.id));
              const current = (await db.query.user.findFirst({ where: eq(authSchema.user.id, user.id) }))?.login ?? '';
              if (current.startsWith(PENDING_PREFIX)) await db.update(authSchema.user).set({ login: await uniqueLogin(db, loginFromEmail(user.email)) }).where(eq(authSchema.user.id, user.id));
            },
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
            // OAuth profiles arrive with a handle. A password sign-up gets a placeholder until the address is verified, so an unverified row cannot hold a name.
            const wanted = typeof current === 'string' && current ? current : verify ? `${PENDING_PREFIX}${randomBytes(6).toString('hex')}` : loginFromEmail(u.email);
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
/** Login held by a password sign-up until its email is verified. Never claimable by anyone else. */
export const PENDING_PREFIX = 'pending-';

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
    if (RESERVED_LOGINS.has(candidate) || (candidate.startsWith(PENDING_PREFIX) && !wanted.startsWith(PENDING_PREFIX))) continue;
    const taken = await db.query.user.findFirst({ where: eq(authSchema.user.login, candidate) });
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Deletes password-only accounts whose email was never verified, after a grace
 * period. Until then an attacker could park someone else's address; after it the
 * real owner can sign up again. OAuth-linked accounts are never touched.
 */
export async function purgeUnverifiedUsers(db: Db, olderThanMs: number, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - olderThanMs);
  const stale = await db.select({ id: authSchema.user.id }).from(authSchema.user).where(and(eq(authSchema.user.emailVerified, false), lt(authSchema.user.createdAt, cutoff)));
  let purged = 0;
  for (const u of stale) {
    const providers = await db.select({ providerId: authSchema.account.providerId }).from(authSchema.account).where(eq(authSchema.account.userId, u.id));
    if (providers.some((a) => a.providerId !== 'credential')) continue;
    await db.delete(authSchema.user).where(eq(authSchema.user.id, u.id));
    purged++;
  }
  return purged;
}
