'use client';

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePreferredLanguage } from "@/app/actions/update-preferred-language";

export type LanguageOption = {
  code: string;
  english_name: string;
  native_name: string | null;
};

export default function LanguageSettingsForm({
  languages,
  initialLanguage,
}: {
  languages: LanguageOption[];
  initialLanguage: string;
}) {
  const router = useRouter();
  const [selectedLanguage, setSelectedLanguage] = useState(initialLanguage);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredLanguages = useMemo(() => {
    const normalized = filter.trim().toLowerCase();
    if (!normalized) return languages;
    return languages.filter((language) => {
      return (
        language.english_name.toLowerCase().includes(normalized) ||
        language.native_name?.toLowerCase().includes(normalized) ||
        language.code.toLowerCase().includes(normalized)
      );
    });
  }, [filter, languages]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus(null);

    startTransition(async () => {
      const result = await updatePreferredLanguage(selectedLanguage);
      if (result.error) {
        setError(result.error);
      } else {
        setStatus("Preferred language updated.");
        updateClientCaches(selectedLanguage);
      }
    });
  };

  const handleSelect = (code: string) => {
    setSelectedLanguage(code);
  };

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/rooms");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/10"
        >
          ← Back
        </button>
        <h2 className="text-2xl font-semibold text-white">Language preference</h2>
      </div>
      <p className="text-sm text-slate-400">
        Choose the language you want to read translations in. This affects the
        chat view and translation cache.
      </p>

      <div className="space-y-3">
        <input
          type="text"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Search language..."
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none"
          disabled={isPending}
        />
        <select
          value={selectedLanguage}
          onChange={(event) => handleSelect(event.target.value)}
          disabled={isPending}
          className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-base text-white focus:border-white/30 focus:outline-none"
        >
          {filteredLanguages.map((language) => (
            <option key={language.code} value={language.code} className="text-slate-900">
              {language.english_name}{language.native_name ? ` (${language.native_name})` : ""}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Saving..." : "Save preference"}
      </button>

      {status ? (
        <p className="text-sm font-medium text-emerald-300">{status}</p>
      ) : null}
      {error ? (
        <p className="text-sm font-medium text-rose-300">{error}</p>
      ) : null}
    </form>
  );
}

function updateClientCaches(language: string) {
  if (typeof window === "undefined") return;
  try {
    document.cookie = `preferred_language=${language}; path=/; max-age=${60 * 60 * 24 * 365}`;
    window.localStorage.setItem("interchat_language", language);
  } catch (error) {
    console.warn("Failed to update client language caches", error);
  }
}
