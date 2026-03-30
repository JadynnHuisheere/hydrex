"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDqByh59Q6fUQfJdKWui-5mC2TrhjFxkZ0",
  authDomain: "hydrex-8e0bb.firebaseapp.com",
  projectId: "hydrex-8e0bb",
  storageBucket: "hydrex-8e0bb.firebasestorage.app",
  messagingSenderId: "2560035280",
  appId: "1:2560035280:web:6246d4353cb5c6843811d5",
  measurementId: "G-WDBLBE4P99"
};

let analyticsPromise: Promise<Analytics | null> | null = null;

function createFirebaseApp(): FirebaseApp {
  const existingApps = getApps();

  if (existingApps.length > 0) {
    return getApp();
  }

  return initializeApp(FIREBASE_CONFIG);
}

export function getFirebaseApp() {
  return createFirebaseApp();
}

export function initializeFirebaseAnalytics() {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  if (!analyticsPromise) {
    analyticsPromise = isSupported().then((supported) => {
      if (!supported) {
        return null;
      }

      return getAnalytics(createFirebaseApp());
    });
  }

  return analyticsPromise;
}