"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, LockKeyhole, Map, Shield, Trophy } from "lucide-react";

import {
  FirebaseConfigWarning,
  FirebaseProjectBadge,
  useAuth
} from "@/components/auth-provider";
import { appConfig } from "@/lib/config";

const appCards = [
  {
    title: "Urbex DB",
    href: "/dashboard/urbex-db",
    description: "Interactive map, approved pins, pending submission pipeline, and moderator handoff.",
    icon: Map,
    requiresLicense: true
  },
  {
    title: "Leaderboard",
    href: "/dashboard/leaderboard",
    description: "Public contribution ranking focused on approved submissions.",
    icon: Trophy,
    requiresLicense: false
  },
  {
    title: "Moderation",
    href: "/dashboard/urbex-db#queue",
    description: "Current queue view is embedded in the Urbex DB shell for admins.",
    icon: Shield,
    requiresLicense: true
  }
];

export default function DashboardPage() {
  const { loading, user, profile, firebaseReady, signOutUser } = useAuth();
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showRedeemed, setShowRedeemed] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, router, user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setShowWelcome(params.has("welcome"));
    setShowRedeemed(params.has("redeemed"));
  }, []);

  const licensed = profile?.role === "licensed" || profile?.role === "admin";

  if (loading || !user) {
    return (
      <main className="app-shell flex items-center justify-center text-sm text-[var(--text-muted)]">
        Loading dashboard...
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section className="panel-strong rounded-[32px] px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow">Dashboard control</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                {appConfig.name}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">
                Access now uses Firebase Authentication and Firestore profile roles.
              </p>
            </div>

            <div className="panel rounded-[28px] px-5 py-4 text-sm text-[var(--text-muted)]">
              <p className="eyebrow">Current session</p>
              <p className="mt-2 text-lg font-semibold text-[var(--text)]">{profile?.name ?? user.displayName ?? user.email}</p>
              <p>{profile?.email ?? user.email}</p>
              <p className="mt-1 uppercase tracking-[0.18em]">Role: {profile?.role ?? "base"}</p>
            </div>
          </div>

          <div className="mt-6">
            <FirebaseConfigWarning />
          </div>

          {showWelcome ? (
            <div className="mt-6 rounded-3xl border border-[var(--olive)]/20 bg-[var(--olive)]/10 px-4 py-3 text-sm text-[var(--olive)]">
              Base account created. Redeem a key when you are ready to unlock premium app access.
            </div>
          ) : null}

          {showRedeemed ? (
            <div className="mt-6 rounded-3xl border border-[var(--olive)]/20 bg-[var(--olive)]/10 px-4 py-3 text-sm text-[var(--olive)]">
              License redeemed. Urbex DB is now unlocked for this session.
            </div>
          ) : null}
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {appCards.map(({ title, href, description, icon: Icon, requiresLicense }) => {
              const locked = requiresLicense && !licensed;

              return (
                <article key={title} className="panel rounded-[28px] p-6">
                  <div className="flex items-center justify-between">
                    <Icon className="size-8 text-[var(--accent)]" />
                    {locked ? <LockKeyhole className="size-5 text-[var(--text-muted)]" /> : null}
                  </div>
                  <h2 className="mt-6 text-2xl font-semibold tracking-[-0.03em]">{title}</h2>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{description}</p>
                  <div className="mt-6">
                    {locked ? (
                      <Link
                        href="/dashboard/redeem"
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold"
                      >
                        Unlock access
                        <ArrowRight className="size-4" />
                      </Link>
                    ) : (
                      <Link
                        href={href}
                        className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                      >
                        Open app
                        <ArrowRight className="size-4" />
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="space-y-5">
            <section className="panel rounded-[28px] p-6">
              <p className="eyebrow">Implementation status</p>
              <div className="mt-5 space-y-4 text-sm leading-7 text-[var(--text-muted)]">
                <p>Auth provider: {firebaseReady ? "Firebase" : "not configured"}</p>
                <p>License redeemed: {profile?.licenseRedeemed ? "yes" : "no"}</p>
                <p>Cloudflare adapter: configured through OpenNext and Wrangler.</p>
              </div>
            </section>

            <section className="panel rounded-[28px] p-6">
              <p className="eyebrow">Next implementation targets</p>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-muted)]">
                <li>Add location submission writes to Firestore with moderation queue flow.</li>
                <li>Enable R2 and signed uploads for submission media.</li>
                <li>Automate license key issuance from Patreon webhook sync.</li>
              </ul>
            </section>

            <div className="panel rounded-[28px] p-6">
              <FirebaseProjectBadge />
            </div>

            <button
              type="button"
              onClick={() => {
                void signOutUser().then(() => {
                  router.replace("/");
                });
              }}
              className="w-full rounded-full border border-[var(--line)] bg-white/70 px-5 py-3 text-sm font-semibold"
            >
              Log out
            </button>
          </aside>
        </section>
      </div>
    </main>
  );
}