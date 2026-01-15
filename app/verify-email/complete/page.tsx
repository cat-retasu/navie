// app/verify-email/complete/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db, storage } from "@/lib/firebase";
import { applyActionCode, signOut } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

const PENDING_EXTRA_KEY = "navie_pending_extra";
const PENDING_AVATAR_KEY = "navie_pending_avatar_dataurl";

// --- helpers ---
async function getOrCreateRoomId(userId: string) {
  const qRoom = query(collection(db, "chatRooms"), where("userId", "==", userId), limit(1));
  const roomSnap = await getDocs(qRoom);
  if (!roomSnap.empty) return roomSnap.docs[0].id;

  const roomRef = await addDoc(collection(db, "chatRooms"), {
    userId,
    lastMessage: "",
    updatedAt: serverTimestamp(),
    adminTyping: false,
    userTyping: false,
  });
  return roomRef.id;
}

async function ensureWelcomeMessage(roomId: string) {
  const msgsRef = collection(db, "chatRooms", roomId, "messages");
  const qMsg = query(msgsRef, orderBy("createdAt", "asc"), limit(1));
  const msgSnap = await getDocs(qMsg);
  if (!msgSnap.empty) return;

  const welcome =
    "ご登録ありがとうございます✨\nまずは「希望エリア・希望業種・希望時給」を教えてください！";

  await addDoc(msgsRef, {
    text: welcome,
    from: "admin",
    sender: "admin",
    createdAt: serverTimestamp(),
    isDeleted: false,
    imageUrl: null,
    readByAdmin: true,
    readByUser: false,
    isEdited: false,
  });

  await updateDoc(doc(db, "chatRooms", roomId), {
    lastMessage: welcome,
    updatedAt: serverTimestamp(),
    adminTyping: false,
    userTyping: false,
  });
}

async function uploadAvatarFromDataUrl(userId: string, dataUrl: string) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const objectRef = ref(storage, `userProfileImages/${userId}/icon`);
  await uploadBytes(objectRef, blob, { contentType: blob.type || "image/png" });
  return await getDownloadURL(objectRef);
}

export default function VerifyEmailCompletePage() {
  const router = useRouter();
  const sp = useSearchParams();

  const [msg, setMsg] = useState("認証を確認しています…");
  const [busy, setBusy] = useState(true);

  const finalizeAfterVerified = async () => {
    const u = auth.currentUser;
    if (!u) throw new Error("not signed in");

    const extraRaw = localStorage.getItem(PENDING_EXTRA_KEY);
    const extra = extraRaw ? JSON.parse(extraRaw) : {};

    // users（認証済みのみ書ける：B運用）
    await setDoc(
      doc(db, "users", u.uid),
      {
        email: u.email ?? "",
        role: "pending",
        createdAt: serverTimestamp(),
        ...extra,
      },
      { merge: true }
    );

    // avatar（任意）
    let iconUrl: string | null = null;
    const avatarDataUrl = sessionStorage.getItem(PENDING_AVATAR_KEY);
    if (avatarDataUrl) {
      iconUrl = await uploadAvatarFromDataUrl(u.uid, avatarDataUrl);
    }

    // profiles
    await setDoc(
      doc(db, "profiles", u.uid),
      {
        status: "pending",
        createdAt: serverTimestamp(),
        nickname: extra.nickname ?? "",
        area: extra.area ?? "",
        iconUrl,
        selfIntro: "",
        photoURLs: [],
        phoneNumber: extra.phoneNumber ?? "",
      },
      { merge: true }
    );

    // chat + welcome
    const roomId = await getOrCreateRoomId(u.uid);
    await ensureWelcomeMessage(roomId);

    // 掃除
    localStorage.removeItem(PENDING_EXTRA_KEY);
    sessionStorage.removeItem(PENDING_AVATAR_KEY);
  };

  useEffect(() => {
    const run = async () => {
      try {
        const u = auth.currentUser;
        if (!u) {
          setMsg("ログイン状態が見つかりません。ログインし直してください。");
          setBusy(false);
          return;
        }

        // 1) メールリンクから来た場合：oobCode で認証確定
        const oobCode = sp.get("oobCode");
        const mode = sp.get("mode");

        if (mode === "verifyEmail" && oobCode) {
          await applyActionCode(auth, oobCode);
        }

        // 2) 状態を更新して emailVerified を最新化
        await u.reload();

        if (!auth.currentUser?.emailVerified) {
          setMsg("まだ認証が完了していません。メール内リンクを開いてから戻ってきてね。");
          setBusy(false);
          return;
        }

        await auth.currentUser.getIdToken(true);

        // 3) 認証済み → 初期作成
        setMsg("認証が完了しました。初期設定中…");
        await finalizeAfterVerified();

        router.replace("/mypage");
      } catch (e: any) {
        setMsg(e?.message ?? "認証の処理に失敗しました。もう一度試してね。");
        setBusy(false);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const backToSent = () => router.replace("/verify-email");

  const doLogout = async () => {
    setBusy(true);
    try {
      await signOut(auth);
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050007] text-white px-5 py-10">
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h1 className="text-lg font-bold">認証完了</h1>
        <p className="mt-2 text-sm text-gray-300 whitespace-pre-wrap">{msg}</p>

        {!busy ? (
          <div className="mt-6 flex gap-2">
            <button
              onClick={backToSent}
              className="flex-1 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2 text-sm hover:bg-white/[0.07]"
            >
              送信済みページへ戻る
            </button>
            <button
              onClick={doLogout}
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2 text-sm text-gray-300 hover:bg-white/[0.05]"
            >
              ログアウト
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
