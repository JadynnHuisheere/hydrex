"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import {
  fetchApprovedLocations,
  fetchLeaderboard,
  fetchPendingSubmissions,
  hasAppAccess,
  reviewSubmission,
  submitLocationSubmission,
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
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [moderationMessage, setModerationMessage] = useState<string | null>(null);
  const [submissionPending, setSubmissionPending] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedState, setSelectedState] = useState("all");
  const submissionFormRef = useRef<HTMLFormElement | null>(null);

  const hasUrbexAccess = hasAppAccess(profile, "urbex-db");
  const canModerate = profile?.role === "admin" || profile?.role === "mod" || hasAppAccess(profile, "moderation");

  async function refreshPanels() {
    const [nextApproved, nextPending, nextLeaderboard] = await Promise.all([
      fetchApprovedLocations(),
      fetchPendingSubmissions(),
      fetchLeaderboard()
    ]);

    setApprovedLocations(nextApproved);
    setPendingSubmissions(nextPending);
    setLeaderboard(nextLeaderboard);
  }

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    if (!loading && user && !hasUrbexAccess) {
      router.replace("/dashboard");
      return;
    }

    if (!loading && user && hasUrbexAccess) {
      void refreshPanels();
    }
  }, [hasUrbexAccess, loading, router, user]);

  async function onReview(submissionId: string, decision: "approved" | "rejected") {
    if (!user) {
      return;
    }

    setReviewingId(submissionId);
    setModerationMessage(null);

    const result = await reviewSubmission(user.uid, submissionId, decision);

    if (!result.ok) {
      setModerationMessage("Could not update that submission right now.");
      setReviewingId(null);
      return;
    }

    setModerationMessage(decision === "approved" ? "Submission approved." : "Submission declined.");
    await refreshPanels();
    setReviewingId(null);
  }

  async function onSubmitLocation(formData: FormData) {
    if (!user) {
      return;
    }

    setSubmissionPending(true);
    setSubmissionMessage(null);

    const result = await submitLocationSubmission({
      uid: user.uid,
      submittedBy: profile?.name ?? user.displayName ?? user.email ?? "Explorer",
      title: String(formData.get("title") ?? ""),
      region: String(formData.get("region") ?? ""),
      state: String(formData.get("state") ?? ""),
      address: String(formData.get("address") ?? ""),
      lat: Number(formData.get("lat") ?? 0),
      lng: Number(formData.get("lng") ?? 0),
      description: String(formData.get("description") ?? ""),
      note: String(formData.get("note") ?? ""),
      images: Number(formData.get("images") ?? 0)
    });

    if (!result.ok) {
      setSubmissionMessage(
        result.reason === "invalid-coordinates"
          ? "Enter valid latitude and longitude values."
          : "Fill out the location details before submitting."
      );
      setSubmissionPending(false);
      return;
    }

    submissionFormRef.current?.reset();
    setSubmissionMessage("Submission sent to the moderation queue.");
    await refreshPanels();
    setSubmissionPending(false);
  }

  const leaderboardTop = useMemo(() => leaderboard.slice(0, 3), [leaderboard]);
  const availableStates = useMemo(
    () => Array.from(new Set(approvedLocations.map((location) => location.state))).sort(),
    [approvedLocations]
  );
  const filteredLocations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return approvedLocations.filter((location) => {
      const matchesState = selectedState === "all" || location.state === selectedState;

      if (!matchesState) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        location.title,
        location.region,
        location.state,
        location.address,
        location.description,
        location.submittedBy
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [approvedLocations, searchTerm, selectedState]);

  if (loading || !user || !hasUrbexAccess) {
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
                  <p className="mt-2 text-xl font-semibold">Search approved pins by state, address, or region</p>
                </div>
                <p className="text-sm text-[var(--text-muted)]">{filteredLocations.length} of {approvedLocations.length} approved locations</p>
              </div>
              <div className="grid gap-4 pb-5 md:grid-cols-[1.3fr_0.7fr]">
                <label className="space-y-2 text-sm text-[var(--text-muted)]">
                  <span>Search by title, address, state, region</span>
                  <input
                    value={searchTerm}
                    onChange={(event) => {
                      setSearchTerm(event.target.value);
                    }}
                    placeholder="Search locations in an area"
                    className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none"
                  />
                </label>
                <label className="space-y-2 text-sm text-[var(--text-muted)]">
                  <span>State</span>
                  <select
                    value={selectedState}
                    onChange={(event) => {
                      setSelectedState(event.target.value);
                    }}
                    className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none"
                  >
                    <option value="all">All states</option>
                    {availableStates.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <UrbexMap locations={filteredLocations} />
            </article>

            <article className="panel rounded-[32px] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="eyebrow">Submit a location</p>
                  <p className="mt-2 text-xl font-semibold">Send new spots into the moderation queue</p>
                </div>
                <span className="rounded-full bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Urbex access enabled
                </span>
              </div>

              <form
                ref={submissionFormRef}
                action={(formData) => {
                  void onSubmitLocation(formData);
                }}
                className="mt-5 space-y-4"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-[var(--text-muted)]">
                    <span>Location title</span>
                    <input
                      name="title"
                      required
                      className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-[var(--text-muted)]">
                    <span>Region</span>
                    <input
                      name="region"
                      required
                      className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-[var(--text-muted)]">
                    <span>State</span>
                    <input
                      name="state"
                      required
                      className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-[var(--text-muted)]">
                    <span>Address</span>
                    <input
                      name="address"
                      required
                      className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm text-[var(--text-muted)]">
                    <span>Latitude</span>
                    <input
                      name="lat"
                      type="number"
                      step="any"
                      required
                      className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-[var(--text-muted)]">
                    <span>Longitude</span>
                    <input
                      name="lng"
                      type="number"
                      step="any"
                      required
                      className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none"
                    />
                  </label>
                </div>

                <label className="space-y-2 text-sm text-[var(--text-muted)]">
                  <span>Description</span>
                  <textarea
                    name="description"
                    required
                    rows={4}
                    className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                  <label className="space-y-2 text-sm text-[var(--text-muted)]">
                    <span>Moderator note</span>
                    <input
                      name="note"
                      placeholder="Access details, safety note, or context"
                      className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-[var(--text-muted)]">
                    <span>Image count</span>
                    <input
                      name="images"
                      type="number"
                      min={0}
                      defaultValue={0}
                      className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none"
                    />
                  </label>
                </div>

                {submissionMessage ? (
                  <div className="rounded-[24px] bg-white/80 p-4 text-sm text-[var(--text-muted)]">
                    {submissionMessage}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={submissionPending}
                  className="rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submissionPending ? "Submitting..." : "Submit to moderation"}
                </button>
              </form>
            </article>
          </div>

          <div className="space-y-6">
            {canModerate ? (
              <section className="panel rounded-[32px] p-6">
                <p className="eyebrow">Moderator menu</p>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <div className="rounded-[24px] bg-white/80 p-4 text-sm text-[var(--text-muted)]">
                    <p className="text-xs uppercase tracking-[0.18em]">Pending queue</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{pendingSubmissions.length}</p>
                  </div>
                  <div className="rounded-[24px] bg-white/80 p-4 text-sm text-[var(--text-muted)]">
                    <p className="text-xs uppercase tracking-[0.18em]">Approved pins</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{approvedLocations.length}</p>
                  </div>
                  <div className="rounded-[24px] bg-white/80 p-4 text-sm text-[var(--text-muted)]">
                    <p className="text-xs uppercase tracking-[0.18em]">Role</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--text)]">{profile?.role ?? "base"}</p>
                  </div>
                </div>

                {moderationMessage ? (
                  <div className="mt-5 rounded-[24px] bg-white/80 p-4 text-sm text-[var(--text-muted)]">
                    {moderationMessage}
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className="panel rounded-[32px] p-6">
              <p className="eyebrow">Approved locations</p>
              <div className="mt-5 space-y-3">
                {filteredLocations.map((location) => (
                  <div key={location.id} className="rounded-[24px] bg-white/80 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-base font-semibold">{location.title}</p>
                      <span className="text-sm text-[var(--olive)]">+{location.points} pts</span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">{location.description}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {location.region} • {location.state} • {location.address}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      Submitted by {location.submittedBy}
                    </p>
                  </div>
                ))}
                {filteredLocations.length === 0 ? (
                  <div className="rounded-[24px] bg-white/80 p-4 text-sm text-[var(--text-muted)]">
                    No approved locations match that area search yet.
                  </div>
                ) : null}
              </div>
            </section>

            <section id="queue" className="panel rounded-[32px] p-6">
              <p className="eyebrow">Moderation queue</p>
              <div className="mt-5 space-y-3">
                {!canModerate ? (
                  <div className="rounded-[24px] bg-white/80 p-4 text-sm text-[var(--text-muted)]">
                    Moderator queue is visible only to admins.
                  </div>
                ) : null}

                {canModerate && pendingSubmissions.length === 0 ? (
                  <div className="rounded-[24px] bg-white/80 p-4 text-sm text-[var(--text-muted)]">
                    No pending submissions.
                  </div>
                ) : null}

                {canModerate && pendingSubmissions.map((submission) => (
                  <div key={submission.id} className="rounded-[24px] bg-white/80 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-base font-semibold">{submission.title}</p>
                      <span className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                        {submission.images} images
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">{submission.note}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {submission.region} • {submission.state} • {submission.address}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      {submission.submittedBy} • {submission.createdAt}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={reviewingId === submission.id}
                        onClick={() => {
                          void onReview(submission.id, "approved");
                        }}
                        className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {reviewingId === submission.id ? "Working..." : `Approve (+${submission.points})`}
                      </button>
                      <button
                        type="button"
                        disabled={reviewingId === submission.id}
                        onClick={() => {
                          void onReview(submission.id, "rejected");
                        }}
                        className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section id="leaderboard" className="panel rounded-[32px] p-6">
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