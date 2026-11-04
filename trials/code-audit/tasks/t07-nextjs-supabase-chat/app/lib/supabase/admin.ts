import { createClient } from '@supabase/supabase-js';

/** Elevated client for provisioning. Server only: never import from a client component. */
export const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
