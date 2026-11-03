import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
// Service role bypasses RLS, handy for the admin views and the notes API.
const serviceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;

/** Browser-safe client for the public pages. */
export const supabase = createClient(url, anonKey);

/** Elevated client. Used by route handlers and the dashboard page. */
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
