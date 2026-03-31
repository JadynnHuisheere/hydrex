"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/components/auth-provider";

const errorCopy: Record<string, string> = {
  "auth/invalid-credential": "Invalid credentials. Check your email and password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/missing-password": "Password is required.",
  "firebase-not-configured": "Firebase is not configured for this environment."
};

export default function LoginPage() {
  const router = useRouter();
  const { loading, user, signInWithEmail } = useAuth();
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, router, user]);

  async function onSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setErrorMessage("Enter both email and password.");
      return;
    }

    setPending(true);
    setErrorMessage(null);

    try {
      await signInWithEmail(email, password);
      router.replace("/dashboard");
    } catch (error) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String((error as { code?: unknown }).code)
          : error instanceof Error
            ? error.message
            : "unknown";
      setErrorMessage(errorCopy[code] ?? "Unable to log in. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="app-shell flex items-center justify-center">
      <div className="panel-strong w-full max-w-lg rounded-[32px] p-8">
        <p className="eyebrow">Account access</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Log into the dashboard</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">
          Sign in with your Firebase email/password account.
        </p>

        {errorMessage ? (
          <div className="mt-6 rounded-3xl border border-[color:var(--danger)]/20 bg-[color:var(--danger)]/8 px-4 py-3 text-sm text-[var(--danger)]">
            {errorMessage}
          </div>
        ) : null}

        <form
          action={(formData) => {
            void onSubmit(formData);
          }}
          className="mt-8 space-y-4"
        >
          <label className="block space-y-2 text-sm text-[var(--text-muted)]">
            <span>Email</span>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <label className="block space-y-2 text-sm text-[var(--text-muted)]">
            <span>Password</span>
            <input
              name="password"
              type="password"
              required
              className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <button
            type="submit"
            disabled={pending || loading}
            className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
          >
            {pending ? "Logging in..." : "Log in"}
          </button>
        </form>

        <div className="mt-6 text-sm text-[var(--text-muted)]">
          Need an account? <Link href="/signup" className="text-[var(--accent-strong)]">Sign up</Link>
        </div>
      </div>
    </main>
  );
}