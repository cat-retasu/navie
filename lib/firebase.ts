// lib/firebase.ts
"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, type Functions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY as string | undefined,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID as string | undefined,
};

// ✅ SSR / build(prerender) で絶対に Firebase client SDK を初期化しない
function canInitInBrowser() {
  return typeof window !== "undefined" && !!firebaseConfig.apiKey;
}

export function getFirebaseAppClient(): FirebaseApp | null {
  if (!canInitInBrowser()) return null;
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getAuthClient(): Auth | null {
  const app = getFirebaseAppClient();
  return app ? getAuth(app) : null;
}

export function getDbClient(): Firestore | null {
  const app = getFirebaseAppClient();
  return app ? getFirestore(app) : null;
}

export function getStorageClient(): FirebaseStorage | null {
  const app = getFirebaseAppClient();
  return app ? getStorage(app) : null;
}

export function getFunctionsClient(region = "asia-northeast1"): Functions | null {
  const app = getFirebaseAppClient();
  return app ? getFunctions(app, region) : null;
}
