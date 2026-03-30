import Link from "next/link";
import { Compass, KeyRound, MapPinned, ShieldCheck, Trophy } from "lucide-react";

const pillars = [
  {
    title: "Restricted dashboard",
    copy: "Show the full app lineup, but only unlock paid tools after license redemption.",
    icon: KeyRound
  },
  {
    title: "Moderated map data",
    copy: "Move location submissions through review before anything reaches the public map.",
    icon: ShieldCheck
  },
  {
    title: "Contributor ranking",
    copy: "Keep the first leaderboard tight: approved submissions and trusted activity only.",
    icon: Trophy
  }
];

export default function HomePage() {
  return (
    <main className="app-shell relative overflow-hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <section className="panel-strong rounded-[32px] px-6 py-8 sm:px-10 sm:py-10">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_0.9fr] lg:items-end">
            <div className="space-y-6">
              <p className="eyebrow">Urbex Dashboard Platform</p>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
                  Build the controlled access layer first, then let Urbex DB grow on top of it.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)] sm:text-lg">
                  This foundation ships the first real vertical slice: account flow, gated
                  dashboard, license redemption prototype, and a map-backed Urbex DB shell.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                >
                  Create account
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-[var(--line)] bg-white/60 px-5 py-3 text-sm font-semibold transition hover:bg-white"
                >
                  Open login
                </Link>
                <Link
                  href="/dashboard"
                  className="rounded-full border border-[var(--line)] px-5 py-3 text-sm font-semibold"
                >
                  View dashboard shell
                </Link>
              </div>
            </div>

            <div className="panel rounded-[28px] p-6">
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
                <div>
                  <p className="eyebrow">Current slice</p>
                  <p className="mt-2 text-2xl font-semibold">Phase 0 to Phase 1</p>
                </div>
                <Compass className="size-8 text-[var(--olive)]" />
              </div>

              <div className="mt-6 grid gap-4 text-sm text-[var(--text-muted)]">
                <div className="rounded-3xl bg-white/70 p-4">
                  Auth is powered by Firebase Authentication with real account state.
                </div>
                <div className="rounded-3xl bg-white/70 p-4">
                  License redemption now updates Firestore user roles for gated app access.
                </div>
                <div className="rounded-3xl bg-white/70 p-4">
                  Urbex DB reads approved pins and moderation queue data from Firestore.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {pillars.map(({ title, copy, icon: Icon }) => (
            <article key={title} className="panel rounded-[28px] p-6">
              <Icon className="size-8 text-[var(--accent)]" />
              <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{copy}</p>
            </article>
          ))}
        </section>

        <section className="panel rounded-[32px] px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Firebase-ready</p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                Create accounts from the signup page. Role defaults to base and upgrades to
                licensed when a valid key is redeemed.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <MapPinned className="size-4 text-[var(--accent)]" />
              Cloudflare-first scaffold
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}