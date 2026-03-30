"use client";

import { getFirebaseApp } from "@/lib/firebase/client";

type FirestoreModule = typeof import("firebase/firestore");
type Timestamp = import("firebase/firestore").Timestamp;

export type UserRole = "base" | "licensed" | "admin";

export type UserProfile = {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  score: number;
  approvedSubmissions: number;
  licenseRedeemed: boolean;
};

export type LocationRecord = {
  id: string;
  title: string;
  region: string;
  status: "approved" | "pending" | "rejected";
  points: number;
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
  createdAt: string;
  images: number;
  note: string;
};

const bootstrapLicenseKeys = ["URBEX-ALPHA-ACCESS", "PATREON-LICENSE-2026"];

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

function mapUserProfile(uid: string, data: Record<string, unknown>): UserProfile {
  return {
    uid,
    email: String(data.email ?? ""),
    name: String(data.name ?? "Explorer"),
    role: (data.role as UserRole) ?? "base",
    score: Number(data.score ?? 0),
    approvedSubmissions: Number(data.approvedSubmissions ?? 0),
    licenseRedeemed: Boolean(data.licenseRedeemed ?? false)
  };
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
      createdAt: firestore.serverTimestamp()
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

  const firestore = await loadFirestore();
  const db = firestore.getFirestore(app);

  const normalized = key.trim().toUpperCase();

  if (normalized.length < 8) {
    return { ok: false, reason: "invalid-key" } as const;
  }

  try {
    await firestore.runTransaction(db, async (tx) => {
      const userRef = firestore.doc(db, "users", uid);
      const keyRef = firestore.doc(db, "licenseKeys", normalized);

      const [userSnap, keySnap] = await Promise.all([tx.get(userRef), tx.get(keyRef)]);

      if (!userSnap.exists()) {
        throw new Error("user-not-found");
      }

      const userRole = String(userSnap.data().role ?? "base") as UserRole;

      if (userRole === "licensed" || userRole === "admin") {
        throw new Error("already-licensed");
      }

      if (!keySnap.exists()) {
        if (!bootstrapLicenseKeys.includes(normalized)) {
          throw new Error("key-not-found");
        }

        tx.set(keyRef, {
          active: true,
          issuedBy: "bootstrap",
          createdAt: firestore.serverTimestamp(),
          redeemedBy: uid,
          redeemedAt: firestore.serverTimestamp()
        });
      } else {
        const existing = keySnap.data() as Record<string, unknown>;

        if (existing.active === false) {
          throw new Error("key-inactive");
        }

        if (existing.redeemedBy) {
          throw new Error("already-used");
        }

        tx.update(keyRef, {
          redeemedBy: uid,
          redeemedAt: firestore.serverTimestamp()
        });
      }

      tx.update(userRef, {
        role: "licensed",
        licenseRedeemed: true,
        licenseKey: normalized,
        updatedAt: firestore.serverTimestamp()
      });
    });

    return { ok: true } as const;
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "unknown-error"
    } as const;
  }
}

export async function fetchLeaderboard() {
  const app = getDb();

  if (!app) {
    return [] as Array<UserProfile & { rank: number }>;
  }

  const firestore = await loadFirestore();
  const db = firestore.getFirestore(app);

  const usersQuery = firestore.query(
    firestore.collection(db, "users"),
    firestore.limit(50)
  );
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

    return {
      id: entry.id,
      title: String(data.title ?? "Untitled location"),
      region: String(data.region ?? "Unknown"),
      status: "approved" as const,
      points: Number(data.points ?? 0),
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

    return {
      id: entry.id,
      title: String(data.title ?? "Untitled submission"),
      submittedBy: String(data.submittedBy ?? "Unknown"),
      createdAt: createdAt ? createdAt.toDate().toLocaleString() : "unknown time",
      images: Number(data.images ?? 0),
      note: String(data.note ?? "Awaiting moderator review.")
    };
  });
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
      status: "pending",
      points: 0,
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
    updatedAt: firestore.serverTimestamp()
  });
}