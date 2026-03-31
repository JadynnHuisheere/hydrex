import Link from "next/link";
import { KeyRound, MapPinned, ShieldCheck, Trophy } from "lucide-react";

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
              <p className="eyebrow">Hydrex</p>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
                  Explore Urbex DB, unlock access, and submit new locations for review.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[var(--text-muted)] sm:text-lg">
                  Public visitors can learn about the platform, while licensed members unlock the
                  Urbex database, contributor ranking, and submission pipeline.
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
                  View dashboard
                </Link>
              </div>
            </div>

            <div className="panel rounded-[28px] p-6">
              <p className="eyebrow">What you unlock</p>
              <div className="mt-6 grid gap-4 text-sm text-[var(--text-muted)]">
                <div className="rounded-3xl bg-white/70 p-4">
                  Search approved locations by area, state, address, and region.
                </div>
                <div className="rounded-3xl bg-white/70 p-4">
                  Submit new locations for moderation once your account has access.
                </div>
                <div className="rounded-3xl bg-white/70 p-4">
                  Track contributor ranking directly inside the Urbex experience.
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
              <p className="eyebrow">Access model</p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                Create an account, redeem a valid key, and unlock the Urbex member experience.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <MapPinned className="size-4 text-[var(--accent)]" />
              Public access available
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}