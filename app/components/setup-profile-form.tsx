'use client';

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeFirstTimeSetup } from "@/app/actions/complete-setup";
import { languageLabel } from "@/lib/chatTypes";

type LanguageOption = {
  code: string;
  english_name: string;
  native_name: string | null;
};

type SetupProfileFormProps = {
  email: string;
  initialDisplayName: string;
  initialLanguage: string;
  languages: LanguageOption[];
};

export function SetupProfileForm({
  email,
  initialDisplayName,
  initialLanguage,
  languages,
}: SetupProfileFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [preferredLanguage, setPreferredLanguage] = useState(initialLanguage);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await completeFirstTimeSetup({
        displayName,
        preferredLanguage,
        password,
        confirmPassword,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccess(true);
      router.replace("/rooms");
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-xl shadow-black/30"
    >
      <header>
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
          Welcome aboard
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">
          Set up your account
        </h1>
        <p className="mt-3 text-sm text-slate-300">
          Email: <span className="font-medium text-white">{email}</span>
        </p>
      </header>

      <div>
        <label className="text-xs uppercase tracking-[0.35em] text-slate-500">
          Display name
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none"
          placeholder="What should people call you?"
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-[0.35em] text-slate-500">
          Preferred language
        </label>
        <select
          value={preferredLanguage}
          onChange={(event) => setPreferredLanguage(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none"
        >
          {languages.map((language) => (
            <option key={language.code} value={language.code}>
              {language.english_name} ({language.native_name ?? languageLabel(language.code)})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="text-xs uppercase tracking-[0.35em] text-slate-500">
            New password
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none"
            placeholder="At least 8 characters"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-[0.35em] text-slate-500">
            Confirm password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            required
            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none"
            placeholder="Type it again"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Saving..." : "Save and join workspace"}
      </button>

      {success ? (
        <p className="text-sm font-medium text-emerald-300">
          Account ready! Redirecting to your workspace…
        </p>
      ) : null}

      {error ? (
        <p className="text-sm font-medium text-rose-300">{error}</p>
      ) : null}

      <p className="text-xs text-slate-400">
        • This password will be required for every future login.  
        • You can change it any time in Settings.
      </p>
    </form>
  );
}
