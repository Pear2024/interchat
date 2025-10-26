import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.warn("NEXT_PUBLIC_SUPABASE_URL is not defined.");
}

if (!serviceRoleKey) {
  console.warn(
    "SUPABASE_SERVICE_ROLE_KEY is not defined. Server actions will not be able to write data."
  );
}

export function getServiceSupabaseClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase service role credentials are missing. Please set SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function getServerSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase environment variables are missing. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        const cookie = cookieStore.get(name);
        return cookie?.value;
      },
      set(name: string, value: string, options?: { path?: string; maxAge?: number }) {
        try {
          cookieStore.set({
            name,
            value,
            path: options?.path ?? "/",
            maxAge: options?.maxAge,
          });
        } catch (error) {
          console.warn("Unable to set cookie in this context", error);
        }
      },
      remove(name: string, options?: { path?: string }) {
        try {
          cookieStore.set({
            name,
            value: "",
            path: options?.path ?? "/",
            maxAge: 0,
          });
        } catch (error) {
          console.warn("Unable to clear cookie in this context", error);
        }
      },
    },
  });
}
