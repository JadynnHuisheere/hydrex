import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, LockKeyhole, Map, Shield, Trophy } from "lucide-react";

import { logoutAction } from "@/app/dashboard/actions";
import { getSession, hasLicensedAccess } from "@/lib/auth/session";
import { appConfig, isSupabaseConfigured } from "@/lib/config";

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

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ redeemed?: string; welcome?: string }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const licensed = hasLicensedAccess(session);

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
                Access is controlled by session role today. Supabase wiring is prepared but still
                awaiting environment variables.
              </p>
            </div>

            <div className="panel rounded-[28px] px-5 py-4 text-sm text-[var(--text-muted)]">
              <p className="eyebrow">Current session</p>
              <p className="mt-2 text-lg font-semibold text-[var(--text)]">{session.name}</p>
              <p>{session.email}</p>
              <p className="mt-1 uppercase tracking-[0.18em]">Role: {session.role}</p>
            </div>
          </div>

          {params.welcome ? (
            <div className="mt-6 rounded-3xl border border-[var(--olive)]/20 bg-[var(--olive)]/10 px-4 py-3 text-sm text-[var(--olive)]">
              Base account created. Redeem a key when you are ready to unlock premium app access.
            </div>
          ) : null}

          {params.redeemed ? (
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
                <p>Demo auth: {appConfig.demoAuthEnabled ? "enabled" : "disabled"}</p>
                <p>Supabase env: {isSupabaseConfigured ? "configured" : "not configured"}</p>
                <p>Cloudflare adapter: configured through OpenNext and Wrangler.</p>
              </div>
            </section>

            <section className="panel rounded-[28px] p-6">
              <p className="eyebrow">Next implementation targets</p>
              <ul className="mt-5 space-y-3 text-sm leading-7 text-[var(--text-muted)]">
                <li>Replace demo auth with Supabase session-backed identity.</li>
                <li>Add database tables for submissions, licenses, and scores.</li>
                <li>Move license redemption from mock keys into persistent storage.</li>
              </ul>
            </section>

            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full rounded-full border border-[var(--line)] bg-white/70 px-5 py-3 text-sm font-semibold"
              >
                Log out
              </button>
            </form>
          </aside>
        </section>
      </div>
    </main>
  );
}