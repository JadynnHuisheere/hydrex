"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/components/auth-provider";
import {
  createLocationForumPost,
  fetchApprovedLocations,
  fetchLeaderboard,
  fetchLocationForumPosts,
  fetchPendingSubmissions,
  type ForumPostRecord,
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
type PanelId = "map" | "submission" | "moderator" | "approved" | "queue" | "leaderboard";
type SelectedPin = {
  id: string;
  title: string;
  region: string;
  state: string;
  address: string;
  lat: number;
  lng: number;
  description: string;
  submittedBy: string;
  images: number;
  imageUrls: string[];
  media: Array<{ kind: "image" | "video"; url: string }>;
};

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
  const [mapSearchTerm, setMapSearchTerm] = useState("");
  const [mapSearchPending, setMapSearchPending] = useState(false);
  const [mapSearchMessage, setMapSearchMessage] = useState<string | null>(null);
  const [mapSearchPoint, setMapSearchPoint] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [selectedState, setSelectedState] = useState("all");
  const [mapStyle, setMapStyle] = useState<"street" | "satellite" | "topo">("street");
  const [showRailwayOverlay, setShowRailwayOverlay] = useState(false);
  const [showPrivateOnly, setShowPrivateOnly] = useState(false);
  const [showEarlyAccess, setShowEarlyAccess] = useState(false);
  const [showWeatherGoldenHour, setShowWeatherGoldenHour] = useState(false);
  const [showContourLines, setShowContourLines] = useState(true);
  const [showWaterway, setShowWaterway] = useState(true);
  const [weatherGoldenHourNote, setWeatherGoldenHourNote] = useState<string | null>(null);
  const [showHeroHeader, setShowHeroHeader] = useState(true);
  const [mapHeight, setMapHeight] = useState(440);
  const [regionValue, setRegionValue] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [addressValue, setAddressValue] = useState("");
  const [latValue, setLatValue] = useState("");
  const [lngValue, setLngValue] = useState("");
  const [clearTempPinToken, setClearTempPinToken] = useState(0);
  const [selectedPin, setSelectedPin] = useState<SelectedPin | null>(null);
  const [forumPosts, setForumPosts] = useState<ForumPostRecord[]>([]);
  const [forumMessage, setForumMessage] = useState<string | null>(null);
  const [forumPending, setForumPending] = useState(false);
  const [submissionFiles, setSubmissionFiles] = useState<File[]>([]);
  const [forumFiles, setForumFiles] = useState<File[]>([]);
  const [submissionDropActive, setSubmissionDropActive] = useState(false);
  const [forumDropActive, setForumDropActive] = useState(false);
  const [showSubmission, setShowSubmission] = useState(true);
  const [showModeratorMenu, setShowModeratorMenu] = useState(true);
  const [showApprovedLocations, setShowApprovedLocations] = useState(true);
  const [showQueue, setShowQueue] = useState(true);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [draggingPanel, setDraggingPanel] = useState<PanelId | null>(null);
  const [panelOrder, setPanelOrder] = useState<Record<PanelId, number>>({
    map: 1,
    submission: 2,
    moderator: 1,
    approved: 2,
    queue: 3,
    leaderboard: 4
  });
  const submissionFormRef = useRef<HTMLFormElement | null>(null);
  const submissionTitleInputRef = useRef<HTMLInputElement | null>(null);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);
  const forumMediaInputRef = useRef<HTMLInputElement | null>(null);

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

  function toAcceptedFiles(files: FileList | File[]) {
    return Array.from(files)
      .filter((file) => file.type.startsWith("image/") || file.type.startsWith("video/"))
      .slice(0, 8);
  }

  function appendSubmissionFiles(files: FileList | File[]) {
    const accepted = toAcceptedFiles(files);
    setSubmissionFiles((current) => [...current, ...accepted].slice(0, 8));
  }

  function appendForumFiles(files: FileList | File[]) {
    const accepted = toAcceptedFiles(files);
    setForumFiles((current) => [...current, ...accepted].slice(0, 8));
  }

  async function openPinForum(pin: SelectedPin) {
    setSelectedPin(pin);
    setForumPending(true);
    setForumMessage(null);
    const posts = await fetchLocationForumPosts(pin.id);
    setForumPosts(posts);
    setForumPending(false);
  }

  function onDropPanel(target: PanelId) {
    if (!draggingPanel || draggingPanel === target) {
      return;
    }

    setPanelOrder((current) => ({
      ...current,
      [draggingPanel]: current[target],
      [target]: current[draggingPanel]
    }));

    setDraggingPanel(null);
  }

  async function onCreateForumPost(formData: FormData) {
    if (!user || !selectedPin) {
      return;
    }

    setForumPending(true);
    setForumMessage(null);

    const upload = await uploadSubmissionMedia(user.uid, forumFiles);

    if (!upload.ok) {
      setForumMessage("Could not upload forum media right now.");
      setForumPending(false);
      return;
    }

    const result = await createLocationForumPost({
      locationId: selectedPin.id,
      uid: user.uid,
      authorName: profile?.name ?? user.displayName ?? user.email ?? "Explorer",
      message: String(formData.get("forumMessage") ?? ""),
      media: upload.media
    });

    if (!result.ok) {
      setForumMessage("Could not publish forum post.");
      setForumPending(false);
      return;
    }

    setForumFiles([]);
    if (forumMediaInputRef.current) {
      forumMediaInputRef.current.value = "";
    }
    setForumMessage("Forum post published.");
    await openPinForum(selectedPin);
    setForumPending(false);
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

  useEffect(() => {
    if (!user || !hasUrbexAccess) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.hidden) {
        return;
      }

      void refreshPanels();
      if (selectedPin) {
        void openPinForum(selectedPin);
      }
    }, 30000);

    return () => {
      window.clearInterval(timer);
    };
  }, [hasUrbexAccess, selectedPin, user]);

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

    const fallbackFiles = (formData.getAll("mediaFiles") as File[]).filter((file) => file.size > 0);
    const selectedFiles = [...submissionFiles, ...fallbackFiles]
      .filter((file, index, source) => source.findIndex((entry) => entry.name === file.name && entry.size === file.size) === index)
      .slice(0, 8);
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
      const errorMessages: Record<string, string> = {
        "invalid-coordinates": "Enter valid latitude and longitude values.",
        "title-too-short": "Location title must be at least 3 characters.",
        "region-too-short": "Region must be at least 2 characters.",
        "state-too-short": "State must be at least 2 characters.",
        "address-too-short": "Address must be at least 5 characters.",
        "description-too-short": "Description must be at least 12 characters.",
        "firebase-not-configured": "Firebase is not configured. Contact support."
      };
      setSubmissionMessage(
        errorMessages[result.reason] ?? "Fill out the location details before submitting."
      );
      setSubmissionPending(false);
      return;
    }

    submissionFormRef.current?.reset();
    if (mediaInputRef.current) {
      mediaInputRef.current.value = "";
    }
    setSubmissionFiles([]);
    setLatValue("");
    setLngValue("");
    setRegionValue("");
    setStateValue("");
    setAddressValue("");
    setSelectedState("all");
    setMapSelectionMessage(null);
    setSubmissionMessage(
      canModerate
        ? "Submission auto-approved and published."
        : "Submission sent to the moderation queue."
    );
    await refreshPanels();
    setSubmissionPending(false);
  }

  function onSelectSubmissionPoint(point: { lat: number; lng: number }) {
    const nextLat = point.lat.toFixed(6);
    const nextLng = point.lng.toFixed(6);

    setLatValue(nextLat);
    setLngValue(nextLng);
    setMapSelectionMessage(`Temporary pin selected at ${nextLat}, ${nextLng}`);

    void (async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(nextLat)}&lon=${encodeURIComponent(nextLng)}&zoom=18&addressdetails=1`,
          {
            headers: {
              Accept: "application/json"
            }
          }
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          display_name?: string;
          address?: Record<string, string | undefined>;
        };

        const nextAddress = data.display_name?.trim();
        const nextState = data.address?.state?.trim();
        const nextRegion =
          data.address?.city?.trim() ||
          data.address?.town?.trim() ||
          data.address?.county?.trim() ||
          data.address?.suburb?.trim();

        if (nextAddress) {
          setAddressValue(nextAddress);
        }

        if (nextState) {
          setStateValue(nextState);
        }

        if (nextRegion) {
          setRegionValue(nextRegion);
        }
      } catch {
        // Ignore reverse geocode failures and keep manual entry available.
      }
    })();

    const continueToForm = window.confirm("Use this pin for a new submission?");

    if (!continueToForm) {
      return;
    }

    submissionFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      submissionTitleInputRef.current?.focus();
    }, 200);
  }

  async function onMapSearch() {
    const query = mapSearchTerm.trim();

    if (query.length < 3) {
      setMapSearchMessage("Enter a full street address to search.");
      return;
    }

    setMapSearchPending(true);
    setMapSearchMessage(null);
    setClearTempPinToken((current) => current + 1);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
        {
          headers: {
            Accept: "application/json"
          }
        }
      );

      if (!response.ok) {
        setMapSearchMessage("Address search is unavailable right now.");
        setMapSearchPending(false);
        return;
      }

      const results = (await response.json()) as Array<{
        lat?: string;
        lon?: string;
        display_name?: string;
      }>;

      const first = results[0];
      const lat = Number(first?.lat ?? NaN);
      const lng = Number(first?.lon ?? NaN);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setMapSearchMessage("No address match found. Try adding city/state.");
        setMapSearchPending(false);
        return;
      }

      setMapSearchPoint({
        lat,
        lng,
        label: first?.display_name ?? query
      });
      setMapSearchMessage(first?.display_name ?? "Address located on map.");
    } catch {
      setMapSearchMessage("Could not complete address search right now.");
    }

    setMapSearchPending(false);
  }

  function onGoToLocation(location: LocationRecord) {
    setMapSearchPoint({
      lat: location.lat,
      lng: location.lng,
      label: location.title
    });
    setMapSearchMessage(`Focused map on ${location.title}.`);
    setClearTempPinToken((current) => current + 1);

    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const leaderboardTop = useMemo(() => leaderboard.slice(0, 50), [leaderboard]);
  const earlyAccessLocations = useMemo(() => {
    if (!showEarlyAccess) {
      return [] as LocationRecord[];
    }

    return pendingSubmissions
      .filter((submission) => Number.isFinite(submission.lat) && Number.isFinite(submission.lng))
      .map((submission) => ({
        id: `early-${submission.id}`,
        title: `[Early] ${submission.title}`,
        region: submission.region,
        state: submission.state,
        address: submission.address,
        status: "pending" as const,
        points: submission.points,
        images: submission.images,
        imageUrls: submission.imageUrls,
        media: submission.media,
        lat: submission.lat,
        lng: submission.lng,
        description: submission.description,
        submittedBy: submission.submittedBy,
        submittedByUid: submission.submittedByUid
      }));
  }, [pendingSubmissions, showEarlyAccess]);
  const availableStates = useMemo(
    () => Array.from(new Set([...approvedLocations, ...earlyAccessLocations].map((location) => location.state))).sort(),
    [approvedLocations, earlyAccessLocations]
  );
  const currentUid = user?.uid ?? "";

  const filteredLocations = useMemo(() => {
    const publicMatches = approvedLocations.filter((location) => {
      const matchesState = selectedState === "all" || location.state === selectedState;
      const matchesPrivate = !showPrivateOnly || (currentUid.length > 0 && location.submittedByUid === currentUid);
      return matchesState && matchesPrivate;
    });

    const earlyAccessMatches = earlyAccessLocations.filter((location) => {
      const matchesState = selectedState === "all" || location.state === selectedState;
      const matchesPrivate = !showPrivateOnly || (currentUid.length > 0 && location.submittedByUid === currentUid);
      return matchesState && matchesPrivate;
    });

    return [...earlyAccessMatches, ...publicMatches];
  }, [approvedLocations, currentUid, earlyAccessLocations, selectedState, showPrivateOnly]);

  const goldenHourTarget = useMemo(() => {
    if (mapSearchPoint) {
      return { lat: mapSearchPoint.lat, lng: mapSearchPoint.lng, label: mapSearchPoint.label };
    }

    const first = filteredLocations[0];
    if (!first) {
      return null;
    }

    return { lat: first.lat, lng: first.lng, label: first.title };
  }, [filteredLocations, mapSearchPoint]);

  useEffect(() => {
    if (!showWeatherGoldenHour || !goldenHourTarget) {
      setWeatherGoldenHourNote(null);
      return;
    }

    void (async () => {
      try {
        const weatherResponse = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(goldenHourTarget.lat))}&longitude=${encodeURIComponent(String(goldenHourTarget.lng))}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`
        );
        const sunResponse = await fetch(
          `https://api.sunrise-sunset.org/json?lat=${encodeURIComponent(String(goldenHourTarget.lat))}&lng=${encodeURIComponent(String(goldenHourTarget.lng))}&formatted=0`
        );

        if (!weatherResponse.ok || !sunResponse.ok) {
          setWeatherGoldenHourNote("Could not load weather/golden-hour details right now.");
          return;
        }

        const weatherData = (await weatherResponse.json()) as {
          current?: { temperature_2m?: number; wind_speed_10m?: number };
        };
        const sunData = (await sunResponse.json()) as {
          results?: { sunrise?: string; sunset?: string };
        };

        const temperature = weatherData.current?.temperature_2m;
        const wind = weatherData.current?.wind_speed_10m;
        const sunrise = sunData.results?.sunrise ? new Date(sunData.results.sunrise) : null;
        const sunset = sunData.results?.sunset ? new Date(sunData.results.sunset) : null;
        const morningGoldenHour = sunrise ? new Date(sunrise.getTime() + 60 * 60 * 1000) : null;
        const eveningGoldenHour = sunset ? new Date(sunset.getTime() - 60 * 60 * 1000) : null;

        const tempLabel = Number.isFinite(temperature) ? `${temperature}°C` : "--";
        const windLabel = Number.isFinite(wind) ? `${wind} km/h` : "--";
        const morningLabel = morningGoldenHour ? morningGoldenHour.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--";
        const eveningLabel = eveningGoldenHour ? eveningGoldenHour.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--";

        setWeatherGoldenHourNote(
          `${goldenHourTarget.label}: ${tempLabel}, wind ${windLabel}. Golden hour ~ ${morningLabel} and ${eveningLabel}.`
        );
      } catch {
        setWeatherGoldenHourNote("Could not load weather/golden-hour details right now.");
      }
    })();
  }, [goldenHourTarget, showWeatherGoldenHour]);

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
        {showHeroHeader ? (
          <section className="panel-strong rounded-[32px] px-6 py-8 sm:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="eyebrow">Urbex DB</p>
                <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                  Approved locations, submission flow, and moderation context in one shell
                </h1>
              </div>

              <div className="flex items-center gap-2">
                <div className="rounded-full bg-white/80 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Licensed access active
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowHeroHeader(false);
                  }}
                  className="rounded-full border border-[var(--line)] px-4 py-2 text-xs font-semibold"
                >
                  Close header
                </button>
              </div>
            </div>
          </section>
        ) : (
          <button
            type="button"
            onClick={() => {
              setShowHeroHeader(true);
            }}
            className="self-start rounded-full border border-[var(--line)] px-4 py-2 text-xs font-semibold"
          >
            Show header
          </button>
        )}

        <section className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
          <div className="flex flex-col gap-6">
            <article
              className="panel rounded-[32px] p-4 sm:p-6"
              style={{ order: panelOrder.map }}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={() => {
                onDropPanel("map");
              }}
            >
              <div className="flex flex-col gap-3 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    draggable
                    onDragStart={() => {
                      setDraggingPanel("map");
                    }}
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] hover:bg-white/50 transition"
                  >
                    ≡
                  </button>
                  <div>
                    <p className="text-lg font-semibold">🗺️ Map</p>
                    <p className="text-sm text-[var(--text-muted)]">Search & explore approved locations</p>
                  </div>
                </div>
                <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start">
                  <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                    <span>Size</span>
                    <input
                      type="range"
                      min={320}
                      max={760}
                      step={20}
                      value={mapHeight}
                      onChange={(event) => {
                        setMapHeight(Number(event.target.value));
                      }}
                      className="w-20"
                    />
                  </label>
                  <p className="rounded-full bg-[var(--olive)]/10 px-3 py-1 text-xs font-semibold text-[var(--olive)] whitespace-nowrap">
                    {filteredLocations.length}/{approvedLocations.length}
                  </p>
                </div>
              </div>
              <div className="grid gap-4 pb-5 md:grid-cols-[1.3fr_0.7fr]">
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void onMapSearch();
                  }}
                  className="space-y-2 text-sm text-[var(--text-muted)]"
                >
                  <span className="block">Street address search</span>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={mapSearchTerm}
                      onChange={(event) => {
                        setMapSearchTerm(event.target.value);
                      }}
                      placeholder="Search like Google Maps (street, city, state)"
                      className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none"
                    />
                    <button
                      type="submit"
                      disabled={mapSearchPending}
                      className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {mapSearchPending ? "Finding..." : "Find"}
                    </button>
                  </div>
                </form>
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
              <div className="mb-5 rounded-2xl border border-[var(--line)] bg-white/75 p-4">
                <p className="text-sm font-semibold">Map options</p>
                <div className="mt-3 grid gap-2 text-xs text-[var(--text-muted)] sm:grid-cols-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showEarlyAccess}
                      onChange={(event) => {
                        setShowEarlyAccess(event.target.checked);
                      }}
                    />
                    Early Access (show pending pins)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showWeatherGoldenHour}
                      onChange={(event) => {
                        setShowWeatherGoldenHour(event.target.checked);
                      }}
                    />
                    Weather & Golden Hour
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showPrivateOnly}
                      onChange={(event) => {
                        setShowPrivateOnly(event.target.checked);
                      }}
                    />
                    Private Locations (my submissions)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showRailwayOverlay}
                      onChange={(event) => {
                        setShowRailwayOverlay(event.target.checked);
                      }}
                    />
                    Railway Overlay
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="mapStyle"
                      checked={mapStyle === "topo"}
                      onChange={() => {
                        setMapStyle("topo");
                      }}
                    />
                    Topo Map
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="mapStyle"
                      checked={mapStyle === "satellite"}
                      onChange={() => {
                        setMapStyle("satellite");
                      }}
                    />
                    Satellite View
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="mapStyle"
                      checked={mapStyle === "street"}
                      onChange={() => {
                        setMapStyle("street");
                      }}
                    />
                    Street Map
                  </label>
                </div>
                {mapStyle === "topo" ? (
                  <div className="mt-3 grid gap-2 text-xs text-[var(--text-muted)] sm:grid-cols-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showContourLines}
                        onChange={(event) => {
                          setShowContourLines(event.target.checked);
                        }}
                      />
                      Contour lines
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={showWaterway}
                        onChange={(event) => {
                          setShowWaterway(event.target.checked);
                        }}
                      />
                      Waterway
                    </label>
                    <span>Location</span>
                  </div>
                ) : null}
                {showWeatherGoldenHour && weatherGoldenHourNote ? (
                  <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs text-[var(--text-muted)]">
                    {weatherGoldenHourNote}
                  </p>
                ) : null}
              </div>
              <UrbexMap
                locations={filteredLocations}
                height={mapHeight}
                onSelectSubmissionPoint={onSelectSubmissionPoint}
                searchPoint={mapSearchPoint}
                clearTempPinToken={clearTempPinToken}
                mapStyle={mapStyle}
                showRailwayOverlay={showRailwayOverlay}
                onOpenPinForum={(pin) => {
                  void openPinForum(pin);
                }}
                onOpenStreetView={(point) => {
                  setStreetViewTarget(point);
                }}
              />
              {mapSearchMessage ? (
                <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm text-[var(--text-muted)]">
                  {mapSearchMessage}
                </p>
              ) : null}
              {mapSelectionMessage ? (
                <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm text-[var(--text-muted)]">
                  {mapSelectionMessage}
                </p>
              ) : null}
            </article>

            <article
              className="panel rounded-[32px] p-4 sm:p-6"
              style={{ order: panelOrder.submission }}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={() => {
                onDropPanel("submission");
              }}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    draggable
                    onDragStart={() => {
                      setDraggingPanel("submission");
                    }}
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] hover:bg-white/50 transition"
                  >
                    ≡
                  </button>
                  <div>
                    <p className="text-lg font-semibold">📤 Submit</p>
                    <p className="text-sm text-[var(--text-muted)]">Share new spots for review</p>
                  </div>
                </div>
                <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
                  <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                    Urbex access
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSubmission((current) => !current);
                    }}
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold hover:bg-white/50 transition"
                  >
                    {showSubmission ? "−" : "+"}
                  </button>
                </div>
              </div>

              {showSubmission ? (
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
                      value={regionValue}
                      onChange={(event) => {
                        setRegionValue(event.target.value);
                      }}
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
                      value={stateValue}
                      onChange={(event) => {
                        setStateValue(event.target.value);
                      }}
                      className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-[var(--text-muted)]">
                    <span>Address</span>
                    <input
                      name="address"
                      required
                      value={addressValue}
                      onChange={(event) => {
                        setAddressValue(event.target.value);
                      }}
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
                    <div
                      onDragOver={(event) => {
                        event.preventDefault();
                        setSubmissionDropActive(true);
                      }}
                      onDragLeave={() => {
                        setSubmissionDropActive(false);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        setSubmissionDropActive(false);
                        appendSubmissionFiles(event.dataTransfer.files);
                      }}
                      className={`rounded-2xl border px-3 py-3 text-xs text-[var(--text-muted)] ${submissionDropActive ? "border-[var(--accent)]" : "border-[var(--line)]"}`}
                    >
                      Drag images/videos here or choose files below
                    </div>
                    <input
                      ref={mediaInputRef}
                      name="mediaFiles"
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={(event) => {
                        if (event.target.files) {
                          appendSubmissionFiles(event.target.files);
                        }
                      }}
                      className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 text-[var(--text)] outline-none"
                    />
                    {submissionFiles.length > 0 ? (
                      <p className="text-xs text-[var(--text-muted)]">{submissionFiles.length} media file(s) attached</p>
                    ) : null}
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
              ) : null}
            </article>
          </div>

          {!selectedPin ? (
          <div className="flex flex-col gap-6">
            {canModerate ? (
              <section
                className="panel rounded-[32px] p-4 sm:p-6"
                style={{ order: panelOrder.moderator }}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={() => {
                  onDropPanel("moderator");
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      draggable
                      onDragStart={() => {
                        setDraggingPanel("moderator");
                      }}
                      className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] hover:bg-white/50 transition"
                    >
                      ≡
                    </button>
                    <div>
                      <p className="text-lg font-semibold">🛡️ Moderator</p>
                      <p className="text-xs text-[var(--text-muted)]">Review & manage submissions</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModeratorMenu((current) => !current);
                    }}
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold hover:bg-white/50 transition"
                  >
                    {showModeratorMenu ? "−" : "+"}
                  </button>
                </div>
                {showModeratorMenu ? (
                  <>
                    <div className="mt-6 space-y-3">
                      <div className="rounded-[20px] bg-white/80 p-5 border border-[var(--line)]">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Pending</p>
                        <p className="mt-3 text-3xl font-bold text-[var(--accent)]">{pendingSubmissions.length}</p>
                      </div>
                      <div className="rounded-[20px] bg-white/80 p-5 border border-[var(--line)]">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Approved</p>
                        <p className="mt-3 text-3xl font-bold text-[var(--olive)]">{approvedLocations.length}</p>
                      </div>
                      <div className="rounded-[20px] bg-white/80 p-5 border border-[var(--line)]">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">Your role</p>
                        <p className="mt-3 text-lg font-semibold capitalize">{profile?.role ?? "base"}</p>
                      </div>
                    </div>

                    {moderationMessage ? (
                      <div className="mt-6 rounded-[20px] bg-white/80 p-4 text-sm text-[var(--text-muted)] border border-[var(--line)]">
                        {moderationMessage}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </section>
            ) : null}

            <section
              className="panel rounded-[32px] p-4 sm:p-6"
              style={{ order: panelOrder.approved }}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={() => {
                onDropPanel("approved");
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    draggable
                    onDragStart={() => {
                      setDraggingPanel("approved");
                    }}
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] hover:bg-white/50 transition"
                  >
                    ≡
                  </button>
                  <div>
                    <p className="text-lg font-semibold">📍 Locations</p>
                    <p className="text-xs text-[var(--text-muted)]">Approved spots on the map</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowApprovedLocations((current) => !current);
                  }}
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold hover:bg-white/50 transition"
                >
                  {showApprovedLocations ? "−" : "+"}
                </button>
              </div>
              {showApprovedLocations ? (
              <div className="mt-6 max-h-[24rem] space-y-3 overflow-y-auto pr-1">
                {filteredLocations.map((location) => (
                  <div key={location.id} className="rounded-[20px] bg-white/80 p-4 border border-[var(--line)] hover:border-[var(--accent)] transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-base leading-tight">{location.title}</p>
                        <p className="mt-2 text-sm text-[var(--text-muted)] line-clamp-2">{location.description}</p>
                      </div>
                      <span className="rounded-full bg-[var(--olive)]/10 px-3 py-1 text-xs font-semibold text-[var(--olive)] whitespace-nowrap">+{location.points}</span>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-[var(--text-muted)]">
                      <p>📍 {location.region} • {location.state} • {location.address}</p>
                      <p>👤 {location.submittedBy}</p>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          onGoToLocation(location);
                        }}
                        className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-white/60 transition"
                      >
                        Go to pin
                      </button>
                    </div>
                  </div>
                ))}
                {filteredLocations.length === 0 ? (
                  <div className="rounded-[20px] bg-white/80 p-4 text-sm text-[var(--text-muted)] border border-[var(--line)]">
                    No approved locations match that area search yet.
                  </div>
                ) : null}
              </div>
              ) : null}
            </section>

            {canModerate ? (
            <section
              id="queue"
              className="panel rounded-[32px] p-4 sm:p-6"
              style={{ order: panelOrder.queue }}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={() => {
                onDropPanel("queue");
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    draggable
                    onDragStart={() => {
                      setDraggingPanel("queue");
                    }}
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] hover:bg-white/50 transition"
                  >
                    ≡
                  </button>
                  <div>
                    <p className="text-lg font-semibold">⏳ Queue</p>
                    <p className="text-xs text-[var(--text-muted)]">Submissions awaiting review</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowQueue((current) => !current);
                  }}
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold hover:bg-white/50 transition"
                >
                  {showQueue ? "−" : "+"}
                </button>
              </div>
              {showQueue ? (
              <div className="mt-6 space-y-3">
                {pendingSubmissions.length === 0 ? (
                  <div className="rounded-[20px] bg-white/80 p-4 text-sm text-[var(--text-muted)] border border-[var(--line)]">
                    ✓ No pending submissions.
                  </div>
                ) : null}

                {pendingSubmissions.map((submission) => (
                  <div key={submission.id} className="rounded-[20px] bg-white/80 p-4 border border-[var(--line)] hover:border-[var(--accent)] transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-base">{submission.title}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{submission.note}</p>
                      </div>
                      <span className="rounded-full bg-[var(--accent)]/10 px-2 py-1 text-xs font-semibold text-[var(--accent)] whitespace-nowrap">{submission.images}🖼</span>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-[var(--text-muted)]">
                      <p>📍 {submission.region} • {submission.state}</p>
                      <p>👤 {submission.submittedBy} • {submission.createdAt}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={reviewingId === submission.id}
                        onClick={() => {
                          void onReview(submission.id, "approved");
                        }}
                        className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {reviewingId === submission.id ? "…" : `✓ +${submission.points}`}
                      </button>
                      <button
                        type="button"
                        disabled={reviewingId === submission.id}
                        onClick={() => {
                          void onReview(submission.id, "rejected");
                        }}
                        className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60 hover:bg-white/50 transition"
                      >
                        ✕ Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              ) : null}
            </section>
            ) : null}

            <section
              id="leaderboard"
              className="panel rounded-[32px] p-4 sm:p-6"
              style={{ order: panelOrder.leaderboard }}
              onDragOver={(event) => {
                event.preventDefault();
              }}
              onDrop={() => {
                onDropPanel("leaderboard");
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    draggable
                    onDragStart={() => {
                      setDraggingPanel("leaderboard");
                    }}
                    className="rounded-full border border-[var(--line)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] hover:bg-white/50 transition"
                  >
                    ≡
                  </button>
                  <div>
                    <p className="text-lg font-semibold">🏆 Rankings</p>
                    <p className="text-xs text-[var(--text-muted)]">Top 50 contributors</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowLeaderboard((current) => !current);
                  }}
                  className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold hover:bg-white/50 transition"
                >
                  {showLeaderboard ? "−" : "+"}
                </button>
              </div>
              {showLeaderboard ? (
              <div className="mt-6 space-y-2">
                {leaderboardTop.length === 0 ? (
                  <div className="rounded-[20px] bg-white/80 p-4 text-sm text-[var(--text-muted)] border border-[var(--line)]">
                    No ranked users yet.
                  </div>
                ) : null}

                {leaderboardTop.map((entry) => (
                  <div key={entry.rank} className="flex items-center justify-between rounded-[20px] bg-white/80 px-4 py-3 text-sm border border-[var(--line)] hover:border-[var(--accent)] transition">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent)] text-xs font-bold text-white">
                        {entry.rank}
                      </span>
                      <span className="font-semibold">{entry.name}</span>
                    </div>
                    <span className="font-semibold text-[var(--accent)]">{entry.score}</span>
                  </div>
                ))}
              </div>
              ) : null}
            </section>
          </div>
          ) : null}
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

      {selectedPin ? (
        <div className="fixed right-0 bottom-0 top-16 z-[9997] w-full max-w-md border-l border-[var(--line)] bg-[var(--background-strong)] p-4 shadow-2xl">
          <div className="panel-strong flex h-full flex-col rounded-[24px] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Pin forum</p>
                <p className="mt-1 text-base font-semibold">{selectedPin.title}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedPin(null);
                  setForumPosts([]);
                  setForumFiles([]);
                }}
                className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold"
              >
                Close
              </button>
            </div>

            <p className="mt-3 text-xs text-[var(--text-muted)]">
              {selectedPin.region} • {selectedPin.state} • {selectedPin.address}
            </p>

            <form
              action={(formData) => {
                void onCreateForumPost(formData);
              }}
              className="mt-4 space-y-3"
            >
              <textarea
                name="forumMessage"
                rows={3}
                placeholder="Add notes, entry updates, conditions, or media context..."
                className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2 text-sm text-[var(--text)] outline-none"
              />

              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setForumDropActive(true);
                }}
                onDragLeave={() => {
                  setForumDropActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setForumDropActive(false);
                  appendForumFiles(event.dataTransfer.files);
                }}
                className={`rounded-2xl border px-3 py-3 text-xs text-[var(--text-muted)] ${forumDropActive ? "border-[var(--accent)]" : "border-[var(--line)]"}`}
              >
                Drag images/videos here or upload
              </div>

              <input
                ref={forumMediaInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(event) => {
                  if (event.target.files) {
                    appendForumFiles(event.target.files);
                  }
                }}
                className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-3 py-2 text-xs"
              />

              {forumFiles.length > 0 ? (
                <p className="text-xs text-[var(--text-muted)]">{forumFiles.length} media file(s) attached</p>
              ) : null}

              <button
                type="submit"
                disabled={forumPending}
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {forumPending ? "Posting..." : "Post to pin forum"}
              </button>
            </form>

            {forumMessage ? (
              <p className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs text-[var(--text-muted)]">{forumMessage}</p>
            ) : null}

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              {forumPosts.length === 0 ? (
                <p className="rounded-xl bg-white/80 px-3 py-2 text-xs text-[var(--text-muted)]">
                  No forum posts yet for this pin.
                </p>
              ) : null}
              {forumPosts.map((post) => (
                <div key={post.id} className="rounded-xl bg-white/80 p-3">
                  <p className="text-xs font-semibold">{post.authorName}</p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{post.createdAt}</p>
                  {post.message ? <p className="mt-2 text-sm">{post.message}</p> : null}
                  {post.media.length > 0 ? (
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {post.media.slice(0, 6).map((mediaItem) => (
                        mediaItem.kind === "video" ? (
                          <video key={mediaItem.url} src={mediaItem.url} className="h-16 w-full rounded-md object-cover" controls preload="metadata" />
                        ) : (
                          <img key={mediaItem.url} src={mediaItem.url} alt="Forum media" className="h-16 w-full rounded-md object-cover" loading="lazy" />
                        )
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}