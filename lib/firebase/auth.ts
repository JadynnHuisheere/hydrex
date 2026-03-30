"use client";

import { getAuth } from "firebase/auth";

import { getFirebaseApp } from "@/lib/firebase/client";

export function getFirebaseAuth() {
  const app = getFirebaseApp();

  if (!app) {
    return null;
  }

  return getAuth(app);
}