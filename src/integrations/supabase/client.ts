import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://bgcfevhwobsotsbtrugr.supabase.co';
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabasePublishableKey) {
  console.warn('VITE_SUPABASE_PUBLISHABLE_KEY não configurada. Defina a chave publicável do Supabase no ambiente do Vite.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export const supabaseProjectUrl = supabaseUrl;
