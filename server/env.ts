import type { AppOptions } from './app';
import { resendSender, sesSender, type MailSender } from './email';

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
  const send = mailSenderFromEnv(env);
  const email = send ? { send } : undefined;
  return {
    databaseUrl,
    origin: env.PUBLIC_ORIGIN ?? baseURL,
    auth: { secret, baseURL, github, google, email, trustedOrigins: [baseURL] },
    cronSecret: env.CRON_SECRET,
    ...overrides,
  };
}

/**
 * SES when its three variables are set, Resend otherwise, nothing without EMAIL_FROM.
 * SES_* rather than AWS_* because Vercel reserves the AWS_* names for its own runtime.
 */
export function mailSenderFromEnv(env: NodeJS.ProcessEnv): MailSender | undefined {
  const from = env.EMAIL_FROM;
  if (!from) return undefined;
  if (env.SES_ACCESS_KEY_ID && env.SES_SECRET_ACCESS_KEY && env.SES_REGION) {
    return sesSender({ region: env.SES_REGION, accessKeyId: env.SES_ACCESS_KEY_ID, secretAccessKey: env.SES_SECRET_ACCESS_KEY, from });
  }
  if (env.RESEND_API_KEY) return resendSender({ apiKey: env.RESEND_API_KEY, from });
  return undefined;
}
