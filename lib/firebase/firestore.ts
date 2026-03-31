"use client";

import { getFirebaseApp } from "@/lib/firebase/client";

type FirestoreModule = typeof import("firebase/firestore");
type Timestamp = import("firebase/firestore").Timestamp;

export type UserRole = "base" | "licensed" | "mod" | "admin";
export type AppLicense = "urbex-db" | "moderation";
export type MediaAsset = {
  kind: "image" | "video";
  url: string;
};

type AppAccessMap = Record<AppLicense, boolean>;

type LicenseKeyRecord = {
  app?: AppLicense;
  active?: boolean;
  keyType?: "app" | "admin";
  singleUse?: boolean;
  redeemedBy?: string;
};

export type UserProfile = {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  score: number;
  approvedSubmissions: number;
  licenseRedeemed: boolean;
  appAccess: AppAccessMap;
};

export type AdminUserRecord = UserProfile & {
  createdAt?: string;
  updatedAt?: string;
};

export type LocationRecord = {
  id: string;
  title: string;
  region: string;
  state: string;
  address: string;
  status: "approved" | "pending" | "rejected";
  points: number;
  images: number;
  imageUrls: string[];
  media: MediaAsset[];
  lat: number;
  lng: number;
  description: string;
  submittedBy: string;
  createdAt?: Timestamp;
};

export type SubmissionRecord = {
  id: string;
  title: string;
  submittedBy: string;
  submittedByUid?: string;
  createdAt: string;
  images: number;
  imageUrls: string[];
  media: MediaAsset[];
  note: string;
  region: string;
  state: string;
  address: string;
  points: number;
};

export type ForumPostRecord = {
  id: string;
  locationId: string;
  authorUid: string;
  authorName: string;
  message: string;
  media: MediaAsset[];
  createdAt: string;
};

const LICENSE_KEY_PATTERN = /^HYDREX-\d{8}$/;
const BOOTSTRAP_ADMIN_KEY = "HYDREX-90000001";

const defaultAppAccess = (): AppAccessMap => ({
  "urbex-db": false,
  moderation: false
});

export const licenseApps: Array<{ id: AppLicense; label: string }> = [
  { id: "urbex-db", label: "Urbex DB access" },
  { id: "moderation", label: "Moderator role" }
];

function getDb() {
  const app = getFirebaseApp();

  if (!app) {
    return null;
  }

  return app;
}

async function loadFirestore() {
  return import("firebase/firestore") as Promise<FirestoreModule>;
}

function toIsoString(value: unknown) {
  const ts = value as Timestamp | undefined;
  return ts ? ts.toDate().toISOString() : undefined;
}

function normalizeAppAccess(raw: unknown): AppAccessMap {
  const source = (raw ?? {}) as Record<string, unknown>;

  return {
    "urbex-db": Boolean(source["urbex-db"]),
    moderation: Boolean(source.moderation)
  };
}

function normalizeMedia(raw: unknown): MediaAsset[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const item = entry as Record<string, unknown>;
      const kind = item.kind;
      const url = item.url;

      if ((kind !== "image" && kind !== "video") || typeof url !== "string" || !/^https?:\/\//i.test(url)) {
        return null;
      }

      return { kind, url } satisfies MediaAsset;
    })
    .filter((entry): entry is MediaAsset => Boolean(entry));
}

function mapUserProfile(uid: string, data: Record<string, unknown>): UserProfile {
  return {
    uid,
    email: String(data.email ?? ""),
    name: String(data.name ?? "Explorer"),
    role: (data.role as UserRole) ?? "base",
    score: Number(data.score ?? 0),
    approvedSubmissions: Number(data.approvedSubmissions ?? 0),
    licenseRedeemed: Boolean(data.licenseRedeemed ?? false),
    appAccess: normalizeAppAccess(data.appAccess)
  };
}

function mapAdminUser(uid: string, data: Record<string, unknown>): AdminUserRecord {
  const profile = mapUserProfile(uid, data);
  return {
    ...profile,
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt)
  };
}

function isKnownApp(value: unknown): value is AppLicense {
  return value === "urbex-db" || value === "moderation";
}

function nextHydrexKey() {
  const suffix = Math.floor(10000000 + Math.random() * 90000000);
  return `HYDREX-${suffix}`;
}

function getErrorReason(error: unknown) {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;

    if (typeof code === "string") {
      return code.replace("firestore/", "");
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "unknown-error";
}

function isModeratorRole(role: UserRole) {
  return role === "mod" || role === "admin";
}

function nextAccessForRole(role: UserRole, existing: AppAccessMap): AppAccessMap {
  if (role === "admin" || role === "mod") {
    return {
      "urbex-db": true,
      moderation: true
    };
  }

  if (role === "licensed") {
    return {
      "urbex-db": existing["urbex-db"],
      moderation: false
    };
  }

  return {
    "urbex-db": false,
    moderation: false
  };
}

function nextRoleForRedeemedApp(currentRole: UserRole, app: AppLicense): UserRole {
  if (currentRole === "admin") {
    return "admin";
  }

  if (app === "moderation") {
    return "mod";
  }

  if (currentRole === "mod") {
    return "mod";
  }

  return "licensed";
}

function nextAccessForRedeemedApp(current: AppAccessMap, app: AppLicense): AppAccessMap {
  if (app === "moderation") {
    return {
      "urbex-db": true,
      moderation: true
    };
  }

  return {
    ...current,
    "urbex-db": true
  };
}

export function hasAppAccess(profile: UserProfile | null, app: AppLicense) {
  if (!profile) {
    return false;
  }

  if (profile.role === "admin") {
    return true;
  }

  if (app === "urbex-db" && isModeratorRole(profile.role)) {
    return true;
  }

  return Boolean(profile.appAccess?.[app]);
}

export async function ensureUserProfile(uid: string, email: string, name?: string) {
  const app = getDb();

  if (!app) {
    return null;
  }

  const firestore = await loadFirestore();
  const db = firestore.getFirestore(app);

  const ref = firestore.doc(db, "users", uid);
  const snap = await firestore.getDoc(ref);

  if (!snap.exists()) {
    await firestore.setDoc(ref, {
      email,
      name: name ?? email.split("@")[0] ?? "Explorer",
      role: "base",
      score: 0,
      approvedSubmissions: 0,
      licenseRedeemed: false,
      appAccess: defaultAppAccess(),
      createdAt: firestore.serverTimestamp(),
      updatedAt: firestore.serverTimestamp()
    });
  }

  const after = await firestore.getDoc(ref);
  return mapUserProfile(uid, (after.data() ?? {}) as Record<string, unknown>);
}

export async function fetchUserProfile(uid: string) {
  const app = getDb();

  if (!app) {
    return null;
  }

  const firestore = await loadFirestore();
  const db = firestore.getFirestore(app);

  const snap = await firestore.getDoc(firestore.doc(db, "users", uid));

  if (!snap.exists()) {
    return null;
  }

  return mapUserProfile(uid, (snap.data() ?? {}) as Record<string, unknown>);
}

export async function redeemLicense(uid: string, key: string) {
  const app = getDb();

  if (!app) {
    return { ok: false, reason: "firebase-not-configured" } as const;
  }

  const normalized = key.trim().toUpperCase();

  if (!LICENSE_KEY_PATTERN.test(normalized)) {
    return { ok: false, reason: "invalid-key-format" } as const;
  }

  const firestore = await loadFirestore();
  const db = firestore.getFirestore(app);
  let redeemedApp: AppLicense | "admin" | null = null;

  try {
    await firestore.runTransaction(db, async (tx) => {
      const userRef = firestore.doc(db, "users", uid);
      const keyRef = firestore.doc(db, "licenseKeys", normalized);

      const [userSnap, keySnap] = await Promise.all([tx.get(userRef), tx.get(keyRef)]);

      if (!userSnap.exists()) {
        throw new Error("user-not-found");
      }

      const userData = userSnap.data() as Record<string, unknown>;
      const userRole = (userData.role as UserRole) ?? "base";
      const userAccess = normalizeAppAccess(userData.appAccess);

      if (!keySnap.exists()) {
        if (normalized !== BOOTSTRAP_ADMIN_KEY) {
          throw new Error("key-not-found");
        }

        tx.set(keyRef, {
          keyType: "admin",
          active: true,
          singleUse: true,
          issuedBy: "bootstrap",
          createdAt: firestore.serverTimestamp(),
          redeemedBy: uid,
          redeemedAt: firestore.serverTimestamp()
        });

        tx.update(userRef, {
          role: "admin",
          licenseRedeemed: true,
          appAccess: {
            "urbex-db": true,
            moderation: true
          },
          updatedAt: firestore.serverTimestamp()
        });

        redeemedApp = "admin";
        return;
      }

      const keyData = keySnap.data() as LicenseKeyRecord;

      if (keyData.active === false) {
        throw new Error("key-inactive");
      }

      if (keyData.singleUse !== false && keyData.redeemedBy) {
        throw new Error("already-used");
      }

      const keyType = keyData.keyType ?? "app";

      if (keyType === "admin") {
        tx.update(keyRef, {
          redeemedBy: uid,
          redeemedAt: firestore.serverTimestamp()
        });

        tx.update(userRef, {
          role: "admin",
          licenseRedeemed: true,
          appAccess: {
            "urbex-db": true,
            moderation: true
          },
          updatedAt: firestore.serverTimestamp()
        });

        redeemedApp = "admin";
        return;
      }

      if (!isKnownApp(keyData.app)) {
        throw new Error("invalid-key-app");
      }

      const nextAccess = nextAccessForRedeemedApp(userAccess, keyData.app);
      const alreadyHasTarget = keyData.app === "moderation"
        ? nextAccessForRole(userRole, userAccess).moderation
        : userAccess["urbex-db"];

      if (alreadyHasTarget) {
        throw new Error("already-has-app-access");
      }

      tx.update(keyRef, {
        redeemedBy: uid,
        redeemedAt: firestore.serverTimestamp()
      });

      tx.update(userRef, {
        role: nextRoleForRedeemedApp(userRole, keyData.app),
        licenseRedeemed: true,
        appAccess: nextAccess,
        updatedAt: firestore.serverTimestamp()
      });

      redeemedApp = keyData.app;
    });

    return { ok: true, app: redeemedApp } as const;
  } catch (error) {
    return {
      ok: false,
      reason: getErrorReason(error)
    } as const;
  }
}

export async function createLicenseKeyForApp(adminUid: string, appLicense: AppLicense) {
  const app = getDb();

  if (!app) {
    return { ok: false, reason: "firebase-not-configured" } as const;
  }

  const firestore = await loadFirestore();
  const db = firestore.getFirestore(app);

  const adminSnap = await firestore.getDoc(firestore.doc(db, "users", adminUid));

  if (!adminSnap.exists() || adminSnap.data().role !== "admin") {
    return { ok: false, reason: "not-admin" } as const;
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = nextHydrexKey();
    const keyRef = firestore.doc(db, "licenseKeys", code);
    const keySnap = await firestore.getDoc(keyRef);

    if (keySnap.exists()) {
      continue;
    }

    await firestore.setDoc(keyRef, {
      keyType: "app",
      app: appLicense,
      active: true,
      singleUse: true,
      createdAt: firestore.serverTimestamp(),
      issuedBy: adminUid
    });

    return { ok: true, code } as const;
  }

  return { ok: false, reason: "key-generation-failed" } as const;
}

export async function fetchUsersForAdmin(adminUid: string) {
  const app = getDb();

  if (!app) {
    return [] as AdminUserRecord[];
  }

  const firestore = await loadFirestore();
  const db = firestore.getFirestore(app);

  const adminSnap = await firestore.getDoc(firestore.doc(db, "users", adminUid));

  if (!adminSnap.exists() || adminSnap.data().role !== "admin") {
    return [] as AdminUserRecord[];
  }

  const usersSnap = await firestore.getDocs(
    firestore.query(firestore.collection(db, "users"), firestore.limit(250))
  );

  const mapped = usersSnap.docs.map((entry) =>
    mapAdminUser(entry.id, (entry.data() ?? {}) as Record<string, unknown>)
  );

  return mapped.sort((left, right) => right.score - left.score);
}

export async function updateUserStatsAsAdmin(
  adminUid: string,
  targetUid: string,
  values: { score: number; approvedSubmissions: number; role: UserRole }
) {
  const app = getDb();

  if (!app) {
    return { ok: false, reason: "firebase-not-configured" } as const;
  }

  const firestore = await loadFirestore();
  const db = firestore.getFirestore(app);

  const [adminSnap, targetSnap] = await Promise.all([
    firestore.getDoc(firestore.doc(db, "users", adminUid)),
    firestore.getDoc(firestore.doc(db, "users", targetUid))
  ]);

  if (!adminSnap.exists() || adminSnap.data().role !== "admin") {
    return { ok: false, reason: "not-admin" } as const;
  }

  if (!targetSnap.exists()) {
    return { ok: false, reason: "user-not-found" } as const;
  }

  const targetData = targetSnap.data() as Record<string, unknown>;
  const nextAccess = nextAccessForRole(values.role, normalizeAppAccess(targetData.appAccess));

  await firestore.updateDoc(firestore.doc(db, "users", targetUid), {
    role: values.role,
    score: Math.max(0, Number(values.score)),
    approvedSubmissions: Math.max(0, Number(values.approvedSubmissions)),
    appAccess: nextAccess,
    licenseRedeemed: values.role === "base" ? false : Boolean(targetData.licenseRedeemed) || nextAccess["urbex-db"],
    updatedAt: firestore.serverTimestamp()
  });

  return { ok: true } as const;
}

export async function fetchLeaderboard() {
  const app = getDb();

  if (!app) {
    return [] as Array<UserProfile & { rank: number }>;
  }

  const firestore = await loadFirestore();
  const db = firestore.getFirestore(app);

  const usersQuery = firestore.query(firestore.collection(db, "users"), firestore.limit(50));
  const snap = await firestore.getDocs(usersQuery);
  const sorted = [...snap.docs].sort(
    (a, b) => Number(b.data().score ?? 0) - Number(a.data().score ?? 0)
  );

  return sorted.map((entry, index) => ({
    ...mapUserProfile(entry.id, (entry.data() ?? {}) as Record<string, unknown>),
    rank: index + 1
  }));
}

export async function fetchApprovedLocations() {
  const app = getDb();

  if (!app) {
    return [] as LocationRecord[];
  }

  const firestore = await loadFirestore();
  const db = firestore.getFirestore(app);

  const locationsQuery = firestore.query(
    firestore.collection(db, "locations"),
    firestore.where("status", "==", "approved"),
    firestore.limit(200)
  );
  const snap = await firestore.getDocs(locationsQuery);

  const mapped = snap.docs.map((entry) => {
    const data = entry.data() as Record<string, unknown>;
    const media = normalizeMedia(data.media);
    const fallbackImageUrls = Array.isArray(data.imageUrls)
      ? data.imageUrls.filter((value): value is string => typeof value === "string")
      : [];
    const imageUrls = media.filter((item) => item.kind === "image").map((item) => item.url);

    return {
      id: entry.id,
      title: String(data.title ?? "Untitled location"),
      region: String(data.region ?? "Unknown"),
      state: String(data.state ?? "Unknown"),
      address: String(data.address ?? "Address unavailable"),
      status: "approved" as const,
      points: Number(data.points ?? 0),
      images: Math.max(Number(data.images ?? 0), imageUrls.length, fallbackImageUrls.length),
      imageUrls: imageUrls.length > 0 ? imageUrls : fallbackImageUrls,
      media: media.length > 0
        ? media
        : fallbackImageUrls.map((url) => ({ kind: "image", url } satisfies MediaAsset)),
      lat: Number(data.lat ?? 0),
      lng: Number(data.lng ?? 0),
      description: String(data.description ?? "No description."),
      submittedBy: String(data.submittedBy ?? "Unknown"),
      createdAt: data.createdAt as Timestamp | undefined
    };
  });

  return mapped.sort((a, b) => {
    const left = a.createdAt?.toMillis() ?? 0;
    const right = b.createdAt?.toMillis() ?? 0;
    return right - left;
  });
}

export async function fetchPendingSubmissions() {
  const app = getDb();

  if (!app) {
    return [] as SubmissionRecord[];
  }

  const firestore = await loadFirestore();
  const db = firestore.getFirestore(app);

  const submissionsQuery = firestore.query(
    firestore.collection(db, "locations"),
    firestore.where("status", "==", "pending"),
    firestore.limit(50)
  );
  const snap = await firestore.getDocs(submissionsQuery);

  const sorted = [...snap.docs].sort((a, b) => {
    const left = (a.data().createdAt as Timestamp | undefined)?.toMillis() ?? 0;
    const right = (b.data().createdAt as Timestamp | undefined)?.toMillis() ?? 0;
    return right - left;
  });

  return sorted.map((entry) => {
    const data = entry.data() as Record<string, unknown>;
    const createdAt = data.createdAt as Timestamp | undefined;
    const media = normalizeMedia(data.media);
    const fallbackImageUrls = Array.isArray(data.imageUrls)
      ? data.imageUrls.filter((value): value is string => typeof value === "string")
      : [];
    const imageUrls = media.filter((item) => item.kind === "image").map((item) => item.url);

    return {
      id: entry.id,
      title: String(data.title ?? "Untitled submission"),
      submittedBy: String(data.submittedBy ?? "Unknown"),
      submittedByUid: typeof data.submittedByUid === "string" ? data.submittedByUid : undefined,
      createdAt: createdAt ? createdAt.toDate().toLocaleString() : "unknown time",
      images: Math.max(Number(data.images ?? 0), imageUrls.length, fallbackImageUrls.length),
      imageUrls: imageUrls.length > 0 ? imageUrls : fallbackImageUrls,
      media: media.length > 0
        ? media
        : fallbackImageUrls.map((url) => ({ kind: "image", url } satisfies MediaAsset)),
      note: String(data.note ?? "Awaiting moderator review."),
      region: String(data.region ?? "Unknown"),
      state: String(data.state ?? "Unknown"),
      address: String(data.address ?? "Address unavailable"),
      points: Number(data.points ?? 25)
    };
  });
}

export async function submitLocationSubmission(input: {
  uid: string;
  submittedBy: string;
  title: string;
  region: string;
  state: string;
  address: string;
  lat: number;
  lng: number;
  description: string;
  note?: string;
  images?: number;
  imageUrls?: string[];
  media?: MediaAsset[];
}) {
  const app = getDb();

  if (!app) {
    return { ok: false, reason: "firebase-not-configured" } as const;
  }

  const firestore = await loadFirestore();
  const db = firestore.getFirestore(app);

  const title = input.title.trim();
  const region = input.region.trim();
  const state = input.state.trim();
  const address = input.address.trim();
  const description = input.description.trim();
  const note = input.note?.trim() || "Awaiting moderator review.";
  const imageUrls = (input.imageUrls ?? [])
    .map((value) => value.trim())
    .filter((value) => /^https?:\/\//i.test(value))
    .slice(0, 8);
  const explicitMedia = (input.media ?? []).filter((item) => /^https?:\/\//i.test(item.url)).slice(0, 8);
  const normalizedMedia = explicitMedia.length > 0
    ? explicitMedia
    : imageUrls.map((url) => ({ kind: "image", url } satisfies MediaAsset));
  const images = Math.max(
    0,
    Math.max(
      Number(input.images ?? 0),
      normalizedMedia.filter((item) => item.kind === "image").length,
      imageUrls.length
    )
  );

  if (title.length < 3) {
    return { ok: false, reason: "title-too-short" } as const;
  }

  if (region.length < 2) {
    return { ok: false, reason: "region-too-short" } as const;
  }

  if (state.length < 2) {
    return { ok: false, reason: "state-too-short" } as const;
  }

  if (address.length < 5) {
    return { ok: false, reason: "address-too-short" } as const;
  }

  if (description.length < 12) {
    return { ok: false, reason: "description-too-short" } as const;
  }

  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    return { ok: false, reason: "invalid-coordinates" } as const;
  }

  await firestore.runTransaction(db, async (tx) => {
    const userRef = firestore.doc(db, "users", input.uid);
    const locationRef = firestore.doc(firestore.collection(db, "locations"));
    const userSnap = await tx.get(userRef);
    const userData = userSnap.exists() ? (userSnap.data() as Record<string, unknown>) : null;
    const userRole = (userData?.role as UserRole | undefined) ?? "base";
    const autoApproved = isModeratorRole(userRole);
    const awardedPoints = 25;

    tx.set(locationRef, {
      title,
      region,
      state,
      address,
      status: autoApproved ? "approved" : "pending",
      points: awardedPoints,
      lat: input.lat,
      lng: input.lng,
      description,
      submittedBy: input.submittedBy,
      submittedByUid: input.uid,
      images,
      media: normalizedMedia,
      imageUrls,
      note: autoApproved ? "Auto-approved moderator submission." : note,
      createdAt: firestore.serverTimestamp(),
      reviewedByUid: autoApproved ? input.uid : null,
      reviewedAt: autoApproved ? firestore.serverTimestamp() : null
    });

    if (autoApproved && userSnap.exists()) {
      tx.update(userRef, {
        score: Number(userData?.score ?? 0) + awardedPoints,
        approvedSubmissions: Number(userData?.approvedSubmissions ?? 0) + 1,
        updatedAt: firestore.serverTimestamp()
      });
    }
  });

  return { ok: true } as const;
}

export async function reviewSubmission(
  actorUid: string,
  submissionId: string,
  decision: "approved" | "rejected"
) {
  const app = getDb();

  if (!app) {
    return { ok: false, reason: "firebase-not-configured" } as const;
  }

  const firestore = await loadFirestore();
  const db = firestore.getFirestore(app);

  try {
    await firestore.runTransaction(db, async (tx) => {
      const actorRef = firestore.doc(db, "users", actorUid);
      const submissionRef = firestore.doc(db, "locations", submissionId);

      const [actorSnap, submissionSnap] = await Promise.all([tx.get(actorRef), tx.get(submissionRef)]);

      if (!actorSnap.exists()) {
        throw new Error("user-not-found");
      }

      const actorRole = (actorSnap.data().role as UserRole) ?? "base";

      if (!isModeratorRole(actorRole)) {
        throw new Error("not-moderator");
      }

      if (!submissionSnap.exists()) {
        throw new Error("submission-not-found");
      }

      const submissionData = submissionSnap.data() as Record<string, unknown>;

      if (submissionData.status !== "pending") {
        throw new Error("already-reviewed");
      }

      const commonUpdate = {
        reviewedByUid: actorUid,
        reviewedAt: firestore.serverTimestamp()
      };

      if (decision === "approved") {
        const awardedPoints = Math.max(0, Number(submissionData.points ?? 25));
        const submitterUid = typeof submissionData.submittedByUid === "string"
          ? submissionData.submittedByUid
          : null;
        const submitterRef = submitterUid ? firestore.doc(db, "users", submitterUid) : null;
        const submitterSnap = submitterRef ? await tx.get(submitterRef) : null;

        tx.update(submissionRef, {
          ...commonUpdate,
          status: "approved",
          points: awardedPoints,
          note: "Approved by moderation."
        });

        if (submitterRef && submitterSnap?.exists()) {
          const submitterData = submitterSnap.data() as Record<string, unknown>;
          tx.update(submitterRef, {
            score: Number(submitterData.score ?? 0) + awardedPoints,
            approvedSubmissions: Number(submitterData.approvedSubmissions ?? 0) + 1,
            updatedAt: firestore.serverTimestamp()
          });
        }

        return;
      }

      tx.update(submissionRef, {
        ...commonUpdate,
        status: "rejected",
        note: "Declined by moderation."
      });
    });

    return { ok: true } as const;
  } catch (error) {
    return {
      ok: false,
      reason: getErrorReason(error)
    } as const;
  }
}

export async function seedSampleLocations(uid: string, name: string) {
  const app = getDb();

  if (!app) {
    return;
  }

  const firestore = await loadFirestore();
  const db = firestore.getFirestore(app);

  const existing = await firestore.getDocs(
    firestore.query(firestore.collection(db, "locations"), firestore.limit(1))
  );

  if (!existing.empty) {
    return;
  }

  const entries = [
    {
      title: "Canal Pump House",
      region: "South Basin",
      state: "London",
      address: "14 Canal Walk, South Basin",
      status: "approved",
      points: 40,
      lat: 51.505,
      lng: -0.09,
      description: "Brick pump station with intact valve room and safe daylight entry window.",
      submittedBy: name,
      submittedByUid: uid,
      images: 1,
      note: "Initial seed",
      createdAt: firestore.serverTimestamp()
    },
    {
      title: "North Yard Control Tower",
      region: "Rail Fringe",
      state: "London",
      address: "3 North Yard Road, Rail Fringe",
      status: "pending",
      points: 25,
      lat: 51.498,
      lng: -0.082,
      description: "Pending moderator review. Exterior access confirmed, interior route unverified.",
      submittedBy: name,
      submittedByUid: uid,
      images: 0,
      note: "Awaiting proof image before moderator decision.",
      createdAt: firestore.serverTimestamp()
    }
  ];

  await Promise.all(
    entries.map((entry) =>
      firestore.setDoc(firestore.doc(firestore.collection(db, "locations")), entry)
    )
  );
}

export async function promoteUserToAdmin(uid: string) {
  const app = getDb();

  if (!app) {
    return;
  }

  const firestore = await loadFirestore();
  const db = firestore.getFirestore(app);

  await firestore.updateDoc(firestore.doc(db, "users", uid), {
    role: "admin",
    appAccess: {
      "urbex-db": true,
      moderation: true
    },
    licenseRedeemed: true,
    updatedAt: firestore.serverTimestamp()
  });
}

export async function fetchLocationForumPosts(locationId: string) {
  const app = getDb();

  if (!app) {
    return [] as ForumPostRecord[];
  }

  const firestore = await loadFirestore();
  const db = firestore.getFirestore(app);

  const snap = await firestore.getDocs(
    firestore.query(firestore.collection(db, "locations", locationId, "forum"), firestore.limit(100))
  );

  const posts = snap.docs.map((entry) => {
    const data = entry.data() as Record<string, unknown>;
    const createdAt = data.createdAt as Timestamp | undefined;

    return {
      id: entry.id,
      locationId,
      authorUid: String(data.authorUid ?? "unknown"),
      authorName: String(data.authorName ?? "Explorer"),
      message: String(data.message ?? ""),
      media: normalizeMedia(data.media),
      createdAt: createdAt ? createdAt.toDate().toLocaleString() : "unknown time"
    } satisfies ForumPostRecord;
  });

  return posts.reverse();
}

export async function createLocationForumPost(input: {
  locationId: string;
  uid: string;
  authorName: string;
  message: string;
  media?: MediaAsset[];
}) {
  const app = getDb();

  if (!app) {
    return { ok: false, reason: "firebase-not-configured" } as const;
  }

  const firestore = await loadFirestore();
  const db = firestore.getFirestore(app);
  const message = input.message.trim();
  const media = (input.media ?? []).filter((item) => /^https?:\/\//i.test(item.url)).slice(0, 8);

  if (message.length < 2 && media.length === 0) {
    return { ok: false, reason: "empty-forum-post" } as const;
  }

  try {
    await firestore.setDoc(firestore.doc(firestore.collection(db, "locations", input.locationId, "forum")), {
      authorUid: input.uid,
      authorName: input.authorName,
      message,
      media,
      createdAt: firestore.serverTimestamp()
    });

    return { ok: true } as const;
  } catch (error) {
    return { ok: false, reason: getErrorReason(error) } as const;
  }
}
