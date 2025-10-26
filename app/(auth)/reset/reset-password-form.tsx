'use client';

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabaseClient";

export default function ResetPasswordForm() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [mode, setMode] = useState<"request" | "update">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    if (params.get("type") === "recovery") {
      setMode("update");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setIsPending(true);
    setStatus(null);
    setError(null);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/auth/reset`,
        }
      );
      if (resetError) {
        setError(resetError.message);
      } else {
        setStatus("We have sent a password reset link to your email.");
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to send reset email."
      );
    } finally {
      setIsPending(false);
    }
  };

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsPending(true);
    setStatus(null);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) {
        setError(updateError.message);
      } else {
        setStatus("Password updated successfully. You can now sign in.");
        setTimeout(() => router.push("/login"), 2000);
      }
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Unable to update password."
      );
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-white">
          {mode === "request" ? "Reset your password" : "Create a new password"}
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          {mode === "request"
            ? "Enter the email address you used when signing up. We'll send instructions to reset your password."
            : "Enter a new password for your account."}
        </p>
      </div>

      {mode === "request" ? (
        <form onSubmit={handleRequest} className="space-y-4">
          <div>
            <label
              htmlFor="reset-email"
              className="text-xs uppercase tracking-[0.35em] text-slate-400"
            >
              Email
            </label>
            <input
              id="reset-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none"
              placeholder="you@example.com"
              disabled={isPending}
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Sending..." : "Send reset link"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <label
              htmlFor="new-password"
              className="text-xs uppercase tracking-[0.35em] text-slate-400"
            >
              New password
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none"
              placeholder="••••••••"
              disabled={isPending}
            />
          </div>
          <div>
            <label
              htmlFor="confirm-password"
              className="text-xs uppercase tracking-[0.35em] text-slate-400"
            >
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:border-white/30 focus:outline-none"
              placeholder="••••••••"
              disabled={isPending}
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/40 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Updating..." : "Update password"}
          </button>
        </form>
      )}

      {status ? (
        <p className="text-sm font-medium text-emerald-300">{status}</p>
      ) : null}
      {error ? (
        <p className="text-sm font-medium text-rose-300">{error}</p>
      ) : null}

      <button
        type="button"
        onClick={() => router.push("/login")}
        className="text-sm text-violet-200 transition hover:text-white"
      >
        Back to login
      </button>
    </div>
  );
}
