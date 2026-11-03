import type { AppContext } from '../app';

/** An API key for a second account, for "not the owner" cases. Signs the account up on first use. */
export async function otherUserKey(ctx: AppContext): Promise<string> {
  const email = 'other@agenthive.local';
  let userId: string;
  try {
    userId = (await ctx.auth.api.signUpEmail({ body: { email, password: 'other-password-123', name: 'Other User' } })).user.id;
  } catch {
    const row = await ctx.db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, email) });
    if (!row) throw new Error('other user missing');
    userId = row.id;
  }
  return (await ctx.auth.api.createApiKey({ body: { name: 'other', userId } })).key;
}
