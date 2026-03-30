"use client";

import type { User } from "firebase/auth";

import { getFirebaseApp } from "@/lib/firebase/client";

async function getFirebaseAuthInstance() {
  const app = getFirebaseApp();

  if (!app) {
    return null;
  }

  const { getAuth } = await import("firebase/auth");
  return getAuth(app);
}

export async function onAuthUserChanged(
  callback: (user: User | null) => void | Promise<void>
) {
  const auth = await getFirebaseAuthInstance();

  if (!auth) {
    return null;
  }

  const { onAuthStateChanged } = await import("firebase/auth");
  return onAuthStateChanged(auth, callback);
}

export async function signInWithEmailAuth(email: string, password: string) {
  const auth = await getFirebaseAuthInstance();

  if (!auth) {
    throw new Error("firebase-not-configured");
  }

  const { signInWithEmailAndPassword } = await import("firebase/auth");
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signUpWithEmailAuth(email: string, password: string) {
  const auth = await getFirebaseAuthInstance();

  if (!auth) {
    throw new Error("firebase-not-configured");
  }

  const { createUserWithEmailAndPassword } = await import("firebase/auth");
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function setAuthDisplayName(user: User, displayName: string) {
  const { updateProfile } = await import("firebase/auth");
  await updateProfile(user, { displayName });
}

export async function signOutAuthUser() {
  const auth = await getFirebaseAuthInstance();

  if (!auth) {
    return;
  }

  const { signOut } = await import("firebase/auth");
  await signOut(auth);
}