import Link from "next/link";
import { redirect } from "next/navigation";

import { loginAction } from "@/app/(auth)/actions";
import { getSession } from "@/lib/auth/session";

const errorCopy: Record<string, string> = {
  "invalid-input": "Enter a valid email and a password with at least 8 characters.",
  "invalid-credentials": "That demo account was not recognized.",
  "auth-provider-missing": "Supabase auth is not wired yet and demo auth has been disabled."
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();

  if (session) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const errorMessage = params.error ? errorCopy[params.error] : null;

  return (
    <main className="app-shell flex items-center justify-center">
      <div className="panel-strong w-full max-w-lg rounded-[32px] p-8">
        <p className="eyebrow">Account access</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Log into the dashboard</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">
          This first implementation slice uses demo accounts until managed auth credentials are
          configured.
        </p>

        {errorMessage ? (
          <div className="mt-6 rounded-3xl border border-[color:var(--danger)]/20 bg-[color:var(--danger)]/8 px-4 py-3 text-sm text-[var(--danger)]">
            {errorMessage}
          </div>
        ) : null}

        <form action={loginAction} className="mt-8 space-y-4">
          <label className="block space-y-2 text-sm text-[var(--text-muted)]">
            <span>Email</span>
            <input
              name="email"
              type="email"
              required
              defaultValue="member@urbex.local"
              className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <label className="block space-y-2 text-sm text-[var(--text-muted)]">
            <span>Password</span>
            <input
              name="password"
              type="password"
              required
              defaultValue="DemoMember123"
              className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
          >
            Log in
          </button>
        </form>

        <div className="mt-6 text-sm text-[var(--text-muted)]">
          Need a base account? <Link href="/signup" className="text-[var(--accent-strong)]">Sign up</Link>
        </div>
      </div>
    </main>
  );
}