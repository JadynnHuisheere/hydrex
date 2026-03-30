import { redirect } from "next/navigation";

import { redeemLicenseAction } from "@/app/dashboard/actions";
import { getSession, hasLicensedAccess } from "@/lib/auth/session";

const errorCopy: Record<string, string> = {
  "invalid-key": "Enter a license key before redeeming.",
  "key-not-found": "That key was not recognized in the current prototype."
};

export default async function RedeemPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (hasLicensedAccess(session)) {
    redirect("/dashboard?redeemed=1");
  }

  const params = await searchParams;
  const errorMessage = params.error ? errorCopy[params.error] : null;

  return (
    <main className="app-shell flex items-center justify-center">
      <div className="panel-strong w-full max-w-xl rounded-[32px] p-8">
        <p className="eyebrow">License redemption</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Unlock Urbex DB</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">
          This prototype validates against seeded keys so you can test the gated dashboard flow
          before Patreon and persistent storage are integrated.
        </p>

        {errorMessage ? (
          <div className="mt-6 rounded-3xl border border-[color:var(--danger)]/20 bg-[color:var(--danger)]/8 px-4 py-3 text-sm text-[var(--danger)]">
            {errorMessage}
          </div>
        ) : null}

        <form action={redeemLicenseAction} className="mt-8 space-y-4">
          <label className="block space-y-2 text-sm text-[var(--text-muted)]">
            <span>License key</span>
            <input
              name="key"
              required
              defaultValue="URBEX-ALPHA-ACCESS"
              className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 uppercase tracking-[0.12em] text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
          >
            Redeem access
          </button>
        </form>

        <div className="mt-6 rounded-3xl bg-white/70 p-4 text-sm text-[var(--text-muted)]">
          Demo keys: URBEX-ALPHA-ACCESS and PATREON-LICENSE-2026
        </div>
      </div>
    </main>
  );
}