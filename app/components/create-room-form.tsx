'use client';

import { useState, useTransition } from "react";
import { createRoom } from "@/app/actions/create-room";

type LanguageOption = {
  code: string;
  english_name: string;
};

type CreateRoomFormProps = {
  languages: LanguageOption[];
  defaultLanguage: string;
};

export default function CreateRoomForm({
  languages,
  defaultLanguage,
}: CreateRoomFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState(defaultLanguage);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createRoom({
        name,
        description,
        defaultLanguage: language,
      });

      if (result?.error) {
        setError(result.error);
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-lg shadow-black/30 backdrop-blur-xl"
    >
      <header>
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
          New room
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">
          Create a collaborative space
        </h1>
        <p className="mt-3 text-sm text-slate-300">
          Rooms group conversations for a team or topic. Invite members after
          creation and we’ll translate messages automatically.
        </p>
      </header>

      <div>
        <label className="text-xs uppercase tracking-[0.35em] text-slate-500">
          Room name
        </label>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Marketing Ops · Asia"
          required
          minLength={3}
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none"
          disabled={isPending}
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-[0.35em] text-slate-500">
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="Share context, expectations, or a welcome message."
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none"
          disabled={isPending}
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-[0.35em] text-slate-500">
          Default language
        </label>
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white focus:border-white/30 focus:outline-none"
          disabled={isPending}
        >
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.english_name} ({lang.code.toUpperCase()})
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Creating…" : "Create room"}
      </button>

      <p className="text-xs text-slate-400">
        Starter plans include up to three active rooms. Need more?{" "}
        <a
          href="mailto:ruttakorn78@me.com"
          className="text-violet-200 underline transition hover:text-white"
        >
          Contact us
        </a>{" "}
        for custom pricing.
      </p>

      {error ? (
        <p className="rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      ) : null}
    </form>
  );
}
