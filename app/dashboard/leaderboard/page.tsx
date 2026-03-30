import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth/session";
import { sampleLeaderboard } from "@/lib/mock/data";

export default async function LeaderboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <main className="app-shell">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="panel-strong rounded-[32px] px-6 py-8">
          <p className="eyebrow">Leaderboard</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Approved contribution ranking</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">
            The first scoring model stays intentionally narrow: approved submissions move rank,
            noisy engagement metrics do not.
          </p>
        </section>

        <section className="panel rounded-[32px] p-5">
          <div className="space-y-3">
            {sampleLeaderboard.map((entry) => (
              <div
                key={entry.rank}
                className="flex items-center justify-between rounded-[24px] bg-white/80 px-4 py-4"
              >
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Rank {entry.rank}
                  </p>
                  <p className="mt-1 text-lg font-semibold">{entry.name}</p>
                </div>
                <div className="text-right text-sm text-[var(--text-muted)]">
                  <p className="text-lg font-semibold text-[var(--text)]">{entry.score} pts</p>
                  <p>{entry.approvedSubmissions} approved submissions</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Link href="/dashboard" className="inline-flex rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}