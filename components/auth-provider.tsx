"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User
} from "firebase/auth";

import { appConfig, isFirebaseConfigured } from "@/lib/config";
import { getFirebaseAuth } from "@/lib/firebase/auth";
import {
  ensureUserProfile,
  fetchUserProfile,
  seedSampleLocations,
  type UserProfile
} from "@/lib/firebase/firestore";

type AuthContextValue = {
  loading: boolean;
  user: User | null;
  profile: UserProfile | null;
  firebaseReady: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadProfile(user: User) {
  const profile = await ensureUserProfile(
    user.uid,
    user.email ?? "unknown@example.com",
    user.displayName ?? undefined
  );

  if (profile) {
    await seedSampleLocations(user.uid, profile.name);
  }

  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const refreshProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    const current = await fetchUserProfile(user.uid);
    setProfile(current);
  }, [user]);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    const auth = getFirebaseAuth();

    if (!auth) {
      setLoading(false);
      return;
    }

    return onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const nextProfile = await loadProfile(nextUser);
      setProfile(nextProfile);
      setLoading(false);
    });
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth();

    if (!auth) {
      throw new Error("firebase-not-configured");
    }

    const credential = await signInWithEmailAndPassword(auth, email, password);
    const nextProfile = await loadProfile(credential.user);
    setProfile(nextProfile);
  }, []);

  const signUpWithEmail = useCallback(
    async (name: string, email: string, password: string) => {
      const auth = getFirebaseAuth();

      if (!auth) {
        throw new Error("firebase-not-configured");
      }

      const credential = await createUserWithEmailAndPassword(auth, email, password);

      if (name.trim().length > 0) {
        await updateProfile(credential.user, {
          displayName: name.trim()
        });
      }

      const nextProfile = await ensureUserProfile(
        credential.user.uid,
        credential.user.email ?? email,
        name.trim()
      );
      setProfile(nextProfile);
    },
    []
  );

  const signOutUser = useCallback(async () => {
    const auth = getFirebaseAuth();

    if (!auth) {
      return;
    }

    await signOut(auth);
    setProfile(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      user,
      profile,
      firebaseReady: isFirebaseConfigured,
      signInWithEmail,
      signUpWithEmail,
      signOutUser,
      refreshProfile
    }),
    [loading, user, profile, signInWithEmail, signUpWithEmail, signOutUser, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}

export function FirebaseConfigWarning() {
  if (isFirebaseConfigured) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-[color:var(--danger)]/20 bg-[color:var(--danger)]/8 px-4 py-3 text-sm text-[var(--danger)]">
      Firebase config is incomplete. Add the NEXT_PUBLIC_FIREBASE_* values to deploy auth and
      Firestore features.
    </div>
  );
}

export function FirebaseProjectBadge() {
  return (
    <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
      Firebase project: {appConfig.firebaseProjectId ?? "not configured"}
    </p>
  );
}