// lib/firebase.ts
"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { getFunctions, type Functions } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function missingKeys() {
  const miss = Object.entries(firebaseConfig)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  return miss;
}

// ✅ SSR / build で絶対に初期化しない + 不足キーを出す
function canInitInBrowser() {
  if (typeof window === "undefined") return false;
  const miss = missingKeys();
  if (miss.length) {
    console.error("[Firebase] missing env keys:", miss);
    return false;
  }
  return true;
}

export function getFirebaseAppClient(): FirebaseApp | null {
  if (!canInitInBrowser()) return null;
  return getApps().length ? getApp() : initializeApp(firebaseConfig as any);
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
