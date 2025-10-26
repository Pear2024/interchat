'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type SupabaseBrowserClient = ReturnType<typeof createClientComponentClient>;

let browserClient: SupabaseBrowserClient | null = null;

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createClientComponentClient();
  }
  return browserClient;
}
