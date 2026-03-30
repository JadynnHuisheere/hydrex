import Link from "next/link";
import { redirect } from "next/navigation";

import { signupAction } from "@/app/(auth)/actions";
import { getSession } from "@/lib/auth/session";

const errorCopy: Record<string, string> = {
  "invalid-input": "Add a name, valid email, and password with at least 8 characters."
};

export default async function SignupPage({
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
        <p className="eyebrow">Account creation</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Create your base account</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">
          New accounts start as base users. Premium access is unlocked after license redemption.
        </p>

        {errorMessage ? (
          <div className="mt-6 rounded-3xl border border-[color:var(--danger)]/20 bg-[color:var(--danger)]/8 px-4 py-3 text-sm text-[var(--danger)]">
            {errorMessage}
          </div>
        ) : null}

        <form action={signupAction} className="mt-8 space-y-4">
          <label className="block space-y-2 text-sm text-[var(--text-muted)]">
            <span>Name</span>
            <input
              name="name"
              required
              defaultValue="Field Scout"
              className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <label className="block space-y-2 text-sm text-[var(--text-muted)]">
            <span>Email</span>
            <input
              name="email"
              type="email"
              required
              defaultValue="scout@example.com"
              className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <label className="block space-y-2 text-sm text-[var(--text-muted)]">
            <span>Password</span>
            <input
              name="password"
              type="password"
              required
              defaultValue="DemoUser123"
              className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
          >
            Create account
          </button>
        </form>

        <div className="mt-6 text-sm text-[var(--text-muted)]">
          Already have access? <Link href="/login" className="text-[var(--accent-strong)]">Log in</Link>
        </div>
      </div>
    </main>
  );
}