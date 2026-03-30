"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { FirebaseConfigWarning, useAuth } from "@/components/auth-provider";
import { redeemLicense } from "@/lib/firebase/firestore";

const errorCopy: Record<string, string> = {
  "invalid-key-format": "Use the key format HYDREX-########.",
  "key-not-found": "That key was not recognized in Firebase licenseKeys.",
  "already-used": "That key has already been redeemed.",
  "already-has-app-access": "This account already has access for that app.",
  "key-inactive": "That key is inactive.",
  "invalid-key-app": "This key is tied to an unknown app.",
  "firebase-not-configured": "Firebase config is incomplete."
};

export default function RedeemPage() {
  const router = useRouter();
  const { loading, user, refreshProfile } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

  }, [loading, router, user]);

  if (loading || !user) {
    return (
      <main className="app-shell flex items-center justify-center text-sm text-[var(--text-muted)]">
        Loading redemption flow...
      </main>
    );
  }

  async function onRedeem(formData: FormData) {
    if (!user) {
      return;
    }

    const key = String(formData.get("key") ?? "");
    setPending(true);
    setErrorMessage(null);

    const result = await redeemLicense(user.uid, key);

    if (!result.ok) {
      setErrorMessage(errorCopy[result.reason] ?? "Unable to redeem key.");
      setPending(false);
      return;
    }

    await refreshProfile();
    router.replace("/dashboard?redeemed=1");
  }

  return (
    <main className="app-shell flex items-center justify-center">
      <div className="panel-strong w-full max-w-xl rounded-[32px] p-8">
        <p className="eyebrow">License redemption</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Unlock apps</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">
          Redeem one HYDREX key at a time. Each key unlocks one app, or promotes to admin if it is an admin key.
        </p>

        <div className="mt-4">
          <FirebaseConfigWarning />
        </div>

        {errorMessage ? (
          <div className="mt-6 rounded-3xl border border-[color:var(--danger)]/20 bg-[color:var(--danger)]/8 px-4 py-3 text-sm text-[var(--danger)]">
            {errorMessage}
          </div>
        ) : null}

        <form
          action={(formData) => {
            void onRedeem(formData);
          }}
          className="mt-8 space-y-4"
        >
          <label className="block space-y-2 text-sm text-[var(--text-muted)]">
            <span>License key</span>
            <input
              name="key"
              required
              placeholder="HYDREX-12345678"
              className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 uppercase tracking-[0.12em] text-[var(--text)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
          >
            {pending ? "Redeeming..." : "Redeem access"}
          </button>
        </form>

        <div className="mt-6 rounded-3xl bg-white/70 p-4 text-sm text-[var(--text-muted)]">
          Format required: HYDREX-########
        </div>
      </div>
    </main>
  );
}