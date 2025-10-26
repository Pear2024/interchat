'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

type LanguageOption = {
  code: string;
  english_name: string;
  native_name: string | null;
};

type LoginFormProps = {
  languages: LanguageOption[];
  initialError?: string | null;
};

const LANGUAGE_STORAGE_KEY = "interchat_language";
const LANGUAGE_COOKIE_KEY = "preferred_language";

export default function LoginForm({
  languages,
  initialError = null,
}: LoginFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [error, setError] = useState<string | null>(initialError);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    const validCodes = new Set(languages.map((lang) => lang.code));
    const defaultOption = languages.find((lang) => lang.code === "en")?.code ?? languages[0]?.code ?? "en";

    if (typeof window === "undefined") {
      return defaultOption;
    }

    const cookieMatch = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${LANGUAGE_COOKIE_KEY}=`));
    const cookieValue = cookieMatch?.split("=")[1];
    const storedValue = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);

    if (cookieValue && validCodes.has(cookieValue)) {
      return cookieValue;
    }
    if (storedValue && validCodes.has(storedValue)) {
      return storedValue;
    }
    return defaultOption;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const { search, hash } = window.location;
    const hashText = hash.startsWith("#") ? hash.slice(1) : hash;
    const searchParams = new URLSearchParams(search);
    const hashParams = new URLSearchParams(hashText);

    const hasRecoveryIndicators =
      searchParams.has("code") ||
      hashParams.has("code") ||
      hashParams.has("access_token") ||
      hashParams.has("refresh_token") ||
      hashParams.has("token_hash") ||
      hashParams.get("type") === "recovery";

    if (hasRecoveryIndicators) {
      const nextUrl = `/auth/reset${search}${hash}`;
      window.location.replace(nextUrl);
    }
  }, []);

  const persistLanguageChoice = useCallback((code: string) => {
    if (typeof window === "undefined") return;

    document.cookie = `${LANGUAGE_COOKIE_KEY}=${code}; path=/; max-age=${60 * 60 * 24 * 365}`;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  }, []);

  const handleLanguageChange = useCallback(
    (code: string) => {
      setSelectedLanguage(code);
      persistLanguageChoice(code);
    },
    [persistLanguageChoice]
  );

  const handleGoogleLogin = useCallback(() => {
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    setIsLoading(true);
    setError(null);
    persistLanguageChoice(selectedLanguage);

    void supabase.auth
      .signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      })
      .catch((oauthError: unknown) => {
        setError(
          oauthError instanceof Error
            ? oauthError.message
            : "Unable to sign in with Google. Please try again."
        );
        setIsLoading(false);
      });
  }, [persistLanguageChoice, selectedLanguage, supabase]);

  return (
    <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 p-10 text-white shadow-2xl shadow-black/30 backdrop-blur-xl">
      <h1 className="text-3xl font-semibold tracking-tight">
        Welcome to Interchat
      </h1>
      <p className="mt-2 text-sm text-slate-300">
        Sign in with your Google account. Email and password login is currently disabled.
      </p>

      <LanguageSelector
        languages={languages}
        value={selectedLanguage}
        onChange={handleLanguageChange}
        disabled={isLoading}
      />

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M21.35 11.1h-9.18v2.92h5.27c-.23 1.47-.94 2.7-2.01 3.54v2.95h3.24c1.89-1.74 2.98-4.3 2.98-7.36 0-.7-.06-1.37-.18-2.05Z"
          />
          <path
            fill="currentColor"
            d="M12.17 22c2.7 0 4.97-.89 6.63-2.39l-3.24-2.95c-.9.6-2.06.96-3.39.96-2.6 0-4.8-1.76-5.59-4.13H3.24v3.05C4.88 19.73 8.27 22 12.17 22Z"
          />
          <path
            fill="currentColor"
            d="M6.58 13.49c-.2-.6-.32-1.23-.32-1.89s.12-1.29.32-1.89V6.66H3.24A9.934 9.934 0 0 0 2.17 11.6c0 1.63.39 3.17 1.07 4.53l3.34-2.64Z"
          />
          <path
            fill="currentColor"
            d="M12.17 4.88c1.47 0 2.78.51 3.81 1.5l2.84-2.84C17.12 1.76 14.86.78 12.17.78 8.27.78 4.88 3.05 3.24 6.66l3.34 2.64c.79-2.37 2.99-4.42 5.59-4.42Z"
          />
        </svg>
        Continue with Google
      </button>

      {error ? (
        <p className="mt-4 text-sm font-medium text-rose-300">{error}</p>
      ) : null}

    </div>
  );
}

function LanguageSelector({
  languages,
  value,
  onChange,
  disabled,
}: {
  languages: LanguageOption[];
  value: string;
  onChange: (code: string) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return languages;
    return languages.filter((language) => {
      return (
        language.english_name.toLowerCase().includes(normalized) ||
        language.native_name?.toLowerCase().includes(normalized) ||
        language.code.toLowerCase().includes(normalized)
      );
    });
  }, [languages, query]);

  return (
    <div className="mt-6">
      <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
        Preferred Language
      </p>
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search language..."
        className="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none"
        disabled={disabled}
      />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="mt-3 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white focus:border-white/30 focus:outline-none"
      >
        {filtered.map((language) => (
          <option key={language.code} value={language.code} className="text-slate-900">
            {language.english_name}{language.native_name ? ` (${language.native_name})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
