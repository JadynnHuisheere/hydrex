"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, LockKeyhole, Map } from "lucide-react";

import {
  FirebaseConfigWarning,
  FirebaseProjectBadge,
  useAuth
} from "@/components/auth-provider";
import { appConfig } from "@/lib/config";
import { hasAppAccess, type AppLicense } from "@/lib/firebase/firestore";

const appCards = [
  {
    title: "Urbex DB",
    app: "urbex-db" as AppLicense,
    href: "/dashboard/urbex-db",
    description: "Interactive map, Urbex leaderboard, submissions, and moderator tools in one shell.",
    icon: Map
  }
];

export default function DashboardPage() {
  const { loading, user, profile, firebaseReady, signOutUser } = useAuth();
  const router = useRouter();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showRedeemed, setShowRedeemed] = useState(false);
  const isAdmin = profile?.role === "admin";

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

  if (loading || !user) {
    return (
      <main className="app-shell flex items-center justify-center text-sm text-[var(--text-muted)]">
        Loading dashboard...
      </main>
    );
  }

  return (
    <main className="app-shell app-shell-compact">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section className="panel-strong rounded-[32px] px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow">Dashboard control</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                {appConfig.name}
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--text-muted)] sm:text-base">
                Urbex DB now contains the map, leaderboard, submissions, and moderator tools behind one access flow.
              </p>
            </div>

            <div className="panel rounded-[28px] px-5 py-4 text-sm text-[var(--text-muted)]">
              <p className="eyebrow">Current session</p>
              <p className="mt-2 text-lg font-semibold text-[var(--text)]">{profile?.name ?? user.displayName ?? user.email}</p>
              <p>{profile?.email ?? user.email}</p>
              <p className="mt-1 uppercase tracking-[0.18em]">Role: {profile?.role ?? "base"}</p>
            </div>
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
            {appCards.map(({ title, href, description, icon: Icon, app }) => {
              const locked = !hasAppAccess(profile, app);

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
                      <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold text-[var(--text-muted)]">
                        Unlock from sidebar
                      </span>
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
              <p className="eyebrow">Unlock key</p>
              <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                Redeem a `HYDREX-########` key to unlock app access from a single flow.
              </p>
              <Link
                href="/dashboard/redeem"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
              >
                Unlock key
                <ArrowRight className="size-4" />
              </Link>
            </section>

            {isAdmin ? (
              <section className="panel rounded-[28px] p-6">
                <p className="eyebrow">Admin controls</p>
                <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">
                  Manage users, tune stats, and generate app keys from one place.
                </p>
                <Link
                  href="/dashboard/admin"
                  className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold"
                >
                  Open admin panel
                  <ArrowRight className="size-4" />
                </Link>

                <div className="mt-5 space-y-4 text-sm leading-7 text-[var(--text-muted)]">
                  <p>Auth provider: {firebaseReady ? "Firebase" : "not configured"}</p>
                  <p>Urbex DB access: {hasAppAccess(profile, "urbex-db") ? "yes" : "no"}</p>
                  <p>Moderator tools: {profile?.role === "mod" || profile?.role === "admin" ? "yes" : "no"}</p>
                  <p>Hosting route: restricted to admins</p>
                </div>

                <div className="mt-5">
                  <FirebaseConfigWarning />
                </div>

                <div className="mt-5 rounded-[24px] bg-white/70 p-4">
                  <FirebaseProjectBadge />
                </div>
              </section>
            ) : null}

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