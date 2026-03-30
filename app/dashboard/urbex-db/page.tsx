"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import {
  fetchApprovedLocations,
  fetchLeaderboard,
  fetchPendingSubmissions,
  type LocationRecord,
  type SubmissionRecord,
  type UserProfile
} from "@/lib/firebase/firestore";

const UrbexMap = dynamic(
  () => import("@/components/urbex-map").then((module) => module.UrbexMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[440px] items-center justify-center rounded-[24px] border border-[var(--line)] bg-white/70 text-sm text-[var(--text-muted)]">
        Loading map...
      </div>
    )
  }
);

type RankedUser = UserProfile & { rank: number };

export default function UrbexDbPage() {
  const { loading, user, profile } = useAuth();
  const router = useRouter();
  const [approvedLocations, setApprovedLocations] = useState<LocationRecord[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<SubmissionRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<RankedUser[]>([]);

  const licensed = profile?.role === "licensed" || profile?.role === "admin";
  const isAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    if (!loading && user && !licensed) {
      router.replace("/dashboard");
      return;
    }

    if (!loading && user && licensed) {
      void Promise.all([
        fetchApprovedLocations().then(setApprovedLocations),
        fetchPendingSubmissions().then(setPendingSubmissions),
        fetchLeaderboard().then(setLeaderboard)
      ]);
    }
  }, [licensed, loading, router, user]);

  const leaderboardTop = useMemo(() => leaderboard.slice(0, 3), [leaderboard]);

  if (loading || !user || !licensed) {
    return (
      <main className="app-shell flex items-center justify-center text-sm text-[var(--text-muted)]">
        Loading Urbex DB...
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="panel-strong rounded-[32px] px-6 py-8 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="eyebrow">Urbex DB</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                Approved locations, submission flow, and moderation context in one shell
              </h1>
            </div>

            <div className="rounded-full bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
              Licensed access active
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
          <div className="space-y-6">
            <article className="panel rounded-[32px] p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-5">
                <div>
                  <p className="eyebrow">Map system</p>
                  <p className="mt-2 text-xl font-semibold">Approved pins only in the first release</p>
                </div>
                <p className="text-sm text-[var(--text-muted)]">{approvedLocations.length} approved locations</p>
              </div>
              <UrbexMap locations={approvedLocations} />
            </article>

            <article className="panel rounded-[32px] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="eyebrow">Submission readiness</p>
                  <p className="mt-2 text-xl font-semibold">Backend path planned next</p>
                </div>
                <span className="rounded-full bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Prototype status
                </span>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] bg-white/80 p-4 text-sm leading-7 text-[var(--text-muted)]">
                  Coordinates, description, and optional image uploads will be the first submission payload.
                </div>
                <div className="rounded-[24px] bg-white/80 p-4 text-sm leading-7 text-[var(--text-muted)]">
                  Images are intended to upload directly to R2 with signed URLs.
                </div>
                <div className="rounded-[24px] bg-white/80 p-4 text-sm leading-7 text-[var(--text-muted)]">
                  Only moderator-approved records will join the public map dataset.
                </div>
              </div>
            </article>
          </div>

          <div className="space-y-6">
            <section className="panel rounded-[32px] p-6">
              <p className="eyebrow">Approved locations</p>
              <div className="mt-5 space-y-3">
                {approvedLocations.map((location) => (
                  <div key={location.id} className="rounded-[24px] bg-white/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-semibold">{location.title}</p>
                      <span className="text-sm text-[var(--olive)]">+{location.points} pts</span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">{location.description}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {location.region} • Submitted by {location.submittedBy}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section id="queue" className="panel rounded-[32px] p-6">
              <p className="eyebrow">Moderation queue</p>
              <div className="mt-5 space-y-3">
                {!isAdmin ? (
                  <div className="rounded-[24px] bg-white/80 p-4 text-sm text-[var(--text-muted)]">
                    Moderator queue is visible only to admins.
                  </div>
                ) : null}

                {isAdmin && pendingSubmissions.length === 0 ? (
                  <div className="rounded-[24px] bg-white/80 p-4 text-sm text-[var(--text-muted)]">
                    No pending submissions.
                  </div>
                ) : null}

                {isAdmin && pendingSubmissions.map((submission) => (
                  <div key={submission.id} className="rounded-[24px] bg-white/80 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-base font-semibold">{submission.title}</p>
                      <span className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {submission.images} images
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">{submission.note}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {submission.submittedBy} • {submission.createdAt}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel rounded-[32px] p-6">
              <p className="eyebrow">Leaderboard snapshot</p>
              <div className="mt-5 space-y-3">
                {leaderboardTop.length === 0 ? (
                  <div className="rounded-[24px] bg-white/80 p-4 text-sm text-[var(--text-muted)]">
                    No ranked users yet.
                  </div>
                ) : null}

                {leaderboardTop.map((entry) => (
                  <div key={entry.rank} className="flex items-center justify-between rounded-[24px] bg-white/80 px-4 py-3 text-sm">
                    <span className="font-semibold">#{entry.rank} {entry.name}</span>
                    <span className="text-[var(--text-muted)]">{entry.score} pts</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </section>

        <Link href="/dashboard" className="inline-flex rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}