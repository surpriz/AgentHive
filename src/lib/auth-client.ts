import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({ basePath: '/api/auth' });

export type SessionUser = { id: string; name: string; email: string; image?: string | null; login?: string | null };

export function loginOf(u: SessionUser | null | undefined): string {
  return u?.login ?? u?.name ?? '';
}
