import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bgcfevhwobsotsbtrugr.supabase.co';

// Supabase publishable keys are intended for browser use.
// Keep RLS enabled on all exposed tables.
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_j021xqH2oEXGRdMg7gQ8hw_Yi7PfnI0';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export const supabaseProjectUrl = supabaseUrl;
