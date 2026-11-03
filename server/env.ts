import type { AppOptions } from './app';
import { resendSender } from './email';

/** Builds app options from process.env. Shared by the Vercel function and the Vite dev plugin. */
export function optionsFromEnv(env: NodeJS.ProcessEnv, overrides: Partial<AppOptions> = {}): AppOptions {
  const databaseUrl = env.DATABASE_URL ?? 'pglite://memory';
  // Production uses the project's canonical host (the custom domain once attached); previews use their own URL so OAuth and cookies line up.
  const vercelHost = env.VERCEL_ENV === 'production' ? (env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL) : env.VERCEL_URL;
  const baseURL = env.BETTER_AUTH_URL ?? (vercelHost ? `https://${vercelHost}` : 'http://localhost:5173');
  const secret = env.BETTER_AUTH_SECRET ?? (env.NODE_ENV === 'production' ? '' : 'dev-only-secret-change-me-0000000000000000');
  if (!secret) throw new Error('BETTER_AUTH_SECRET is required in production');
  const github = env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET ? { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET } : undefined;
  const google = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } : undefined;
  // Email sign-in needs a way to send the verification link; without a sender it stays off.
  const email = env.RESEND_API_KEY && env.EMAIL_FROM ? { send: resendSender({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM }) } : undefined;
  return {
    databaseUrl,
    origin: env.PUBLIC_ORIGIN ?? baseURL,
    auth: { secret, baseURL, github, google, email, trustedOrigins: [baseURL] },
    cronSecret: env.CRON_SECRET,
    ...overrides,
  };
}
