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
import { uploadSubmissionMedia } from "@/lib/firebase/storage";

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
  const [mapSelectionMessage, setMapSelectionMessage] = useState<string | null>(null);
  const [streetViewTarget, setStreetViewTarget] = useState<{ lat: number; lng: number; title: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedState, setSelectedState] = useState("all");
  const [latValue, setLatValue] = useState("");
  const [lngValue, setLngValue] = useState("");
  const submissionFormRef = useRef<HTMLFormElement | null>(null);
  const submissionTitleInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);

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
      const reasonMessage: Record<string, string> = {
        "not-moderator": "Your account is missing moderator permissions.",
        "submission-not-found": "This submission no longer exists.",
        "already-reviewed": "This submission was already reviewed.",
        "user-not-found": "Your user record was not found.",
        "permission-denied": "Firestore denied this action. Check rules for moderator updates."
      };

      setModerationMessage(
        reasonMessage[result.reason] ?? "Could not update that submission right now."
      );
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

    const selectedFiles = (formData.getAll("mediaFiles") as File[]).filter((file) => file.size > 0);
    const upload = await uploadSubmissionMedia(user.uid, selectedFiles);

    if (!upload.ok) {
      setSubmissionMessage("Could not upload media files. Check Firebase Storage rules and try again.");
      setSubmissionPending(false);
      return;
    }

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
      images: Number(formData.get("images") ?? 0),
      media: upload.media,
      imageUrls: String(formData.get("imageUrls") ?? "")
        .split(/\r?\n|,/) 
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
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
    if (mediaInputRef.current) {
      mediaInputRef.current.value = "";
    }
    setLatValue("");
    setLngValue("");
    setMapSelectionMessage(null);
    setSubmissionMessage("Submission sent to the moderation queue.");
    await refreshPanels();
    setSubmissionPending(false);
  }

  function onSelectSubmissionPoint(point: { lat: number; lng: number }) {
    const nextLat = point.lat.toFixed(6);
    const nextLng = point.lng.toFixed(6);

    setLatValue(nextLat);
    setLngValue(nextLng);
    setMapSelectionMessage(`Temporary pin selected at ${nextLat}, ${nextLng}`);

    const continueToForm = window.confirm("Use this pin for a new submission?");

    if (!continueToForm) {
      return;
    }

    submissionFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      submissionTitleInputRef.current?.focus();
    }, 200);
  }

  const leaderboardTop = useMemo(() => leaderboard.slice(0, 50), [leaderboard]);
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
              <UrbexMap
                locations={filteredLocations}
                onSelectSubmissionPoint={onSelectSubmissionPoint}
                onOpenStreetView={(point) => {
                  setStreetViewTarget(point);
                }}
              />
              {mapSelectionMessage ? (
                <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm text-[var(--text-muted)]">
                  {mapSelectionMessage}
                </p>
              ) : null}
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
                      ref={submissionTitleInputRef}
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
                      value={latValue}
                      onChange={(event) => {
                        setLatValue(event.target.value);
                      }}
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
                      value={lngValue}
                      onChange={(event) => {
                        setLngValue(event.target.value);
                      }}
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
                    <span>Upload images/videos</span>
                    <input
                      ref={mediaInputRef}
                      name="mediaFiles"
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-[var(--text-muted)]">
                    <span>Image URLs</span>
                    <textarea
                      name="imageUrls"
                      rows={3}
                      placeholder="https://... (separate by comma or new line)"
                      className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-[var(--text-muted)]">
                    <span>Moderator note</span>
                    <input
                      name="note"
                      placeholder="Access details, safety note, or context"
                      className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_180px]">
                  <div className="text-xs text-[var(--text-muted)]">
                    Uploaded files and URL media both show in map pin previews.
                  </div>
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
              <p className="eyebrow">Leaderboard top 50</p>
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

      {streetViewTarget ? (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/65 p-4">
          <div className="panel-strong w-full max-w-4xl rounded-[24px] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Street View: {streetViewTarget.title}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {streetViewTarget.lat.toFixed(6)}, {streetViewTarget.lng.toFixed(6)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStreetViewTarget(null);
                }}
                className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-semibold"
              >
                Close
              </button>
            </div>
            <iframe
              title={`Street View ${streetViewTarget.title}`}
              src={`https://maps.google.com/maps?q=&layer=c&cbll=${streetViewTarget.lat},${streetViewTarget.lng}&cbp=11,0,0,0,0&output=svembed`}
              className="h-[70vh] w-full rounded-[16px] border border-[var(--line)]"
              loading="lazy"
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}