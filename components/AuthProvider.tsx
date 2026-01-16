// components/AuthProvider.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useMemo,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";

import { getAuthClient, getDbClient } from "@/lib/firebase";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";

type UserData = {
  email: string;
  role: "user" | "admin" | "pending" | "rejected" | "suspended";
  createdAt?: any;

  phoneNumber?: string;

  nickname?: string;
  birthDate?: string;
  area?: string;
  experienceLevel?: "none" | "cabaret" | "girls_bar" | "lounge";
  experienceYears?: string;
  experienceShops?: string;
  averageSales?: string;
  maxSales?: string;

  currentJob?: string;
  residenceStation?: string;
  preferredShift?: string;
  preferredJobType?: string;
  preferredHourlyWage?: string;
};

type AuthContextValue = {
  user: User | null;
  userData: UserData | null;
  loading: boolean;

  signup: (
    email: string,
    password: string,
    extra?: Partial<UserData>,
    avatarFile?: File | null
  ) => Promise<void>;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// B運用：未認証の間はDBに書かないので一時保存
const PENDING_EXTRA_KEY = "navie_pending_extra";
const PENDING_AVATAR_KEY = "navie_pending_avatar_dataurl";

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const auth = useMemo(() => getAuthClient(), []);
  const db = useMemo(() => getDbClient(), []);


  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;
    if (!auth || !db) {
      setLoading(false);
      return;
    }

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);

      // 前回購読を解除
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }

      // 未ログイン
      if (!fbUser) {
        setUserData(null);
        setLoading(false);
        return;
      }

      // ✅ 未認証は /verify-email に固定（Firestoreに触らない）
      if (!fbUser.emailVerified) {
        setUserData(null);
        setLoading(false);

        if (!pathname?.startsWith("/verify-email")) {
          router.replace("/verify-email");
        }
        return;
      }

      // ✅ Rules側 token.email_verified を更新（認証直後は古いことがある）
      try {
        await fbUser.getIdToken(true);
      } catch (e) {
        console.error("getIdToken(true) failed:", e);
      }

      // ここから Firestore OK
      setLoading(true);

      const refUser = doc(db, "users", fbUser.uid);

      // users が無ければ最小で作成（認証済みなので通る）
      try {
        const snap = await getDoc(refUser);
        if (!snap.exists()) {
          await setDoc(refUser, {
            email: fbUser.email ?? "",
            role: "pending",
            createdAt: serverTimestamp(),
          });
        }
      } catch (e) {
        console.error("users getDoc/setDoc failed:", e);
        setUserData(null);
        setLoading(false);
        return;
      }

      // users をリアルタイム購読
      unsubUserDoc = onSnapshot(
        refUser,
        (docSnap) => {
          const data = docSnap.data() as any;

          if (!data) {
            setUserData(null);
          } else {
            setUserData({
              email: data.email ?? fbUser.email ?? "",
              role: (data.role as any) ?? "pending",
              createdAt: data.createdAt,

              phoneNumber: data.phoneNumber,

              nickname: data.nickname,
              birthDate: data.birthDate,
              area: data.area,
              experienceLevel: data.experienceLevel,
              experienceYears: data.experienceYears,
              experienceShops: data.experienceShops,
              averageSales: data.averageSales,
              maxSales: data.maxSales,

              currentJob: data.currentJob,
              residenceStation: data.residenceStation,
              preferredShift: data.preferredShift,
              preferredJobType: data.preferredJobType,
              preferredHourlyWage: data.preferredHourlyWage,
            });
          }

          setLoading(false);
        },
        (err) => {
          console.error("user doc snapshot error:", err);
          setUserData(null);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, [router, pathname, auth, db]);

  const signup = async (
  email: string,
  password: string,
  extra?: Partial<UserData>,
  avatarFile?: File | null
) => {
  if (!auth) throw new Error("Firebase Auth が初期化できてない（env or browser）");
  setLoading(true);

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // ...以下そのまま
  } finally {
    setLoading(false);
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const fbUser = cred.user;

    // ✅ extra は一時保存（DBには書かない）
    if (extra) localStorage.setItem(PENDING_EXTRA_KEY, JSON.stringify(extra));
    else localStorage.removeItem(PENDING_EXTRA_KEY);

    // ✅ avatar も一時保存（任意）
    if (avatarFile) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("avatar read failed"));
        reader.readAsDataURL(avatarFile);
      });
      sessionStorage.setItem(PENDING_AVATAR_KEY, dataUrl);
    } else {
      sessionStorage.removeItem(PENDING_AVATAR_KEY);
    }

    // ✅ Resend経由で認証メール送信（Functions callable）
    const functions = getFunctions(undefined, "asia-northeast1");
    const sendVerificationEmail = httpsCallable(functions, "sendVerificationEmail");
    await sendVerificationEmail({ nickname: extra?.nickname ?? "" });

    router.replace("/verify-email");
  } finally {
    setLoading(false);
  }
};

  const login = async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase Auth が初期化できてない（env or browser）");
  setLoading(true);
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } finally {
    setLoading(false);
  }
  };

  const logout = async () => {
  if (!auth) return; // ここは落とさず黙って抜けてもOK
  setLoading(true);
  try {
    await signOut(auth);
    setUser(null);
    setUserData(null);
    router.replace("/login");
  } finally {
    setLoading(false);
  }
};

  return (
    <AuthContext.Provider
      value={{ user, userData, loading, signup, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
