"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

import { appConfig, isFirebaseConfigured } from "@/lib/config";

let analyticsPromise: Promise<Analytics | null> | null = null;

function createFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured) {
    throw new Error("Firebase configuration is incomplete.");
  }

  const existingApps = getApps();

  if (existingApps.length > 0) {
    return getApp();
  }

  return initializeApp({
    apiKey: appConfig.firebaseApiKey,
    authDomain: appConfig.firebaseAuthDomain,
    projectId: appConfig.firebaseProjectId,
    storageBucket: appConfig.firebaseStorageBucket,
    messagingSenderId: appConfig.firebaseMessagingSenderId,
    appId: appConfig.firebaseAppId,
    measurementId: appConfig.firebaseMeasurementId
  });
}

export function getFirebaseApp() {
  if (!isFirebaseConfigured) {
    return null;
  }

  return createFirebaseApp();
}

export function initializeFirebaseAnalytics() {
  if (!isFirebaseConfigured || typeof window === "undefined") {
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