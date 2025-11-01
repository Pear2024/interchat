import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options?: { path?: string }) {
        cookieStore.set({ name, value, path: options?.path ?? "/" });
      },
      remove(name: string) {
        cookieStore.delete(name);
      },
    },
  });

  if (!code) {
    return NextResponse.redirect(new URL("/", requestUrl.origin));
  }

  await supabase.auth.exchangeCodeForSession(code);

  const { data: userResult } = await supabase.auth.getUser();
  const destination =
    userResult.user?.user_metadata?.password_configured === true
      ? "/rooms"
      : "/auth/setup";

  return NextResponse.redirect(new URL(destination, requestUrl.origin));
}
