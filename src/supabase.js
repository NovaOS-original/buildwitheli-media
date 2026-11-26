import { createClient } from '@supabase/supabase-js';
import { createBrowserAuthLock } from './auth-lock.js';
import { createAuthFetch } from './auth-fetch.js';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://xtchvetdluriblzyknhp.supabase.co';
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_x09bPZTKwfqbMeYJh7llWQ_5IWavdcK';

export const supabase = createClient(url, publishableKey, {
  global: {
    fetch: createAuthFetch()
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // GitHub Pages sites share one origin and localStorage across paths.
    // Isolate BUILDWITHELI MEDIA from other Nova OS apps using this Supabase project.
    storageKey: 'bwm-media-auth-v1',
    // Serialize auth operations across tabs sharing this app's local session.
    lock: createBrowserAuthLock(globalThis.navigator?.locks),
    lockAcquireTimeout: 10000
  }
});
