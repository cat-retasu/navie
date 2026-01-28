// components/AuthProvider.tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";

import {
  getAuthClient,
  getDbClient,
  getFunctionsClient,
  getStorageClient,
} from "@/lib/firebase";

import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  getFirestore,
} from "firebase/firestore";

import { httpsCallable } from "firebase/functions";
import { ref as sref, uploadBytes, getDownloadURL } from "firebase/storage";

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

  // ✅ 追加：アイコン保存
  avatarUrl?: string;
  avatarPath?: string;

  // ✅ 追加：pending反映済みフラグ
  pendingAppliedAt?: any;
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

function pickExtFromMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/jpeg") return "jpg";
  return "jpg";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const auth = useMemo(() => getAuthClient(), []);
  const db = useMemo(() => getDbClient(), []);
  const functions = useMemo(() => getFunctionsClient("asia-northeast1"), []);
  const storage = useMemo(() => getStorageClient(), []);

  const fileToDataUrlResized = async (file: File, max = 512, quality = 0.85) => {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("image load failed"));
      i.src = String(r.result);
    };
    r.onerror = () => reject(new Error("file read failed"));
    r.readAsDataURL(file);
  });

  const scale = Math.min(max / img.width, max / img.height, 1);
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas ctx failed");
  ctx.drawImage(img, 0, 0, w, h);

  return canvas.toDataURL("image/jpeg", quality); // jpeg固定で軽い
};

  // ✅ 認証後：pending（一時保存）を Firestore/Storage に反映して掃除
  const applyPendingIfAny = async (uid: string) => {
  if (!db) return;

  // extra（localStorage）
  let extra: any = null;
  try {
    const raw = localStorage.getItem(PENDING_EXTRA_KEY);
    extra = raw ? JSON.parse(raw) : null;
  } catch {}

  // avatar（localStorage）
  let avatarDataUrl = "";
  try {
    avatarDataUrl = localStorage.getItem(PENDING_AVATAR_KEY) ?? "";
  } catch {}

  // 何も無ければ終了
  if (!extra && !avatarDataUrl) return;

  const userRef = doc(db, "users", uid);
  const profileRef = doc(db, "profiles", uid);

  // ✅ extra を users / profiles に保存（成功したら localStorage を消す）
  if (extra) {
    try {
      await updateDoc(userRef, {
        ...extra,
        pendingExtraAppliedAt: serverTimestamp(),
      });

      // ✅ UIが profiles を参照してるなら、最低限ここにも入れる
      await setDoc(
        profileRef,
        {
          ...extra,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      try {
        localStorage.removeItem(PENDING_EXTRA_KEY);
      } catch {}
    } catch (e) {
      console.error("updateDoc/setDoc(extra) failed:", e);
      // 失敗したら消さない（次回また試す）
    }
  }

  // ✅ avatar を Storage に保存 → users.avatarUrl + profiles.iconUrl に反映
  if (avatarDataUrl) {
    const storageNow = getStorageClient(); // firebase.ts 準拠で都度取得
    if (!storageNow) {
      console.error(
        "[Storage] not initialized. check env NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
      );
      return;
    }

    try {
      const res = await fetch(avatarDataUrl);
      const blob = await res.blob();

      const ext =
        blob.type === "image/png"
          ? "png"
          : blob.type === "image/webp"
          ? "webp"
          : "jpg";

      // ✅ Storage Rules に合わせる: /userProfileImages/{uid}/{fileName}
      const path = `userProfileImages/${uid}/avatar.${ext}`;

      const storageRef = sref(storageNow, path);
      await uploadBytes(storageRef, blob, { contentType: blob.type });

      const url = await getDownloadURL(storageRef);

      // ✅ users にも保存（内部用）
      await updateDoc(userRef, {
        avatarUrl: url,
        avatarPath: path,
        pendingAvatarAppliedAt: serverTimestamp(),
      });

      // ✅ profiles にも保存（UIが iconUrl を見てるなら必須）
      await setDoc(
        profileRef,
        {
          iconUrl: url,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // ✅ 成功した時だけ消す
      try {
        localStorage.removeItem(PENDING_AVATAR_KEY);
      } catch {}
    } catch (e) {
      console.error("avatar upload / save failed:", e);
      // 失敗したら消さない（次回また試す）
    }
  }
};

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

      // emailVerified の更新を拾うため reload
      try {
        await fbUser.reload();
      } catch (e) {
        console.error("reload failed:", e);
      }

      // ✅ 未認証なら /verify-email（Firestoreには触らない）
      if (!fbUser.emailVerified) {
        setUserData(null);
        setLoading(false);
        if (!pathname?.startsWith("/verify-email")) router.replace("/verify-email");
        return;
      }

      // ✅ 認証済みなら token を強制更新（rules の email_verified を最新化）
      try {
        await fbUser.getIdToken(true);
      } catch (e) {
        console.error("getIdToken(true) failed:", e);
      }

      // ここから Firestore OK
      setLoading(true);

      const refUser = doc(db, "users", fbUser.uid);

      // users が無ければ最小で作成
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

      // ✅ pending反映（毎回呼ぶ：中でキーが無ければ即return）
try {
  await applyPendingIfAny(fbUser.uid);
} catch (e) {
  console.error("applyPendingIfAny failed:", e);
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

              avatarUrl: data.avatarUrl,
              avatarPath: data.avatarPath,
              pendingAppliedAt: data.pendingAppliedAt,
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
    const uid = cred.user.uid;

    // ✅ ここで users / profiles を作る（未認証でも create を許可する rules にする）
    if (!db) throw new Error("Firestore が初期化できてない（env or browser）");

    const userRef = doc(db, "users", uid);
    const profileRef = doc(db, "profiles", uid);

    const safeExtra = extra ?? {};

    await setDoc(
      userRef,
      {
        email,
        role: "pending",
        createdAt: serverTimestamp(),
        ...safeExtra,
      },
      { merge: true }
    );

    await setDoc(
      profileRef,
      {
        ...safeExtra,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // ✅ avatar は「今すぐ反映」したいならここでアップロードして users.avatarUrl 等を埋める
    // ただし Storage rules が未認証書き込みを許可してない場合は失敗するので、
    // まずは現状の “認証後に applyPendingIfAny() で反映” を残してもOK。
    if (avatarFile) {
      const dataUrl = await fileToDataUrlResized(avatarFile, 512, 0.85);
      localStorage.setItem(PENDING_AVATAR_KEY, dataUrl);
    } else {
      localStorage.removeItem(PENDING_AVATAR_KEY);
    }

    // ✅ Resend経由で認証メール送信
    if (!functions) throw new Error("Functions が初期化できてない（env or browser）");
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
    if (!auth) return;
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
    <AuthContext.Provider value={{ user, userData, loading, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}