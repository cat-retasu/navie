// app/admin/users/[id]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getDbClient } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { setUserRole } from "@/lib/setUserRole";
import { UserProfileView } from "@/components/UserProfileView";

type UserDoc = {
  email: string;
  role: string;
  createdAt?: string;
};

type ProfileDoc = {
  // users コレクション由来
  nickname?: string;
  birthDate?: string;
  area?: string;
  phoneNumber?: string;

  experienceLevel?: string; // none / lounge / ... / other or free text
  experienceYears?: string;
  experienceShops?: string;
  averageSales?: string;
  maxSales?: string;

  currentJob?: string;
  residenceStation?: string;

  preferredShift?: string;
  preferredJobType?: string; // lounge / ... / other or free text
  preferredHourlyWage?: string;

  // profiles コレクション由来
  iconUrl?: string | null;
  selfIntro?: string;
  status?: string;
  adminMemo?: string;

  photos: string[];
  createdAt?: string;
};

type ChatRoomInfo = {
  roomId: string;
  lastMessage?: string;
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const { user, userData, loading } = useAuth();
  const db = useMemo(() => getDbClient(), []);

  const [userDoc, setUserDoc] = useState<UserDoc | null>(null);
  const [profile, setProfile] = useState<ProfileDoc | null>(null);
  const [chatRoom, setChatRoom] = useState<ChatRoomInfo | null>(null);

  const [loadingAll, setLoadingAll] = useState(true);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // 管理者チェック :contentReference[oaicite:1]{index=1}
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (userData?.role !== "admin") {
      router.replace("/mypage");
      return;
    }
  }, [user, userData, loading, router]);

  // データ取得（users + profiles をマージ） :contentReference[oaicite:2]{index=2}
    useEffect(() => {
    if (!userId) return;
    if (!db) return;

    const fetchAll = async () => {
      try {
        setLoadingAll(true);
        setError(null);

        // users/{id}
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        let userBaseProfile: Partial<ProfileDoc> = {};
        let userCreatedAt: string | undefined;
        let userRole = "";
        let userEmail = "";

        if (userSnap.exists()) {
          const d = userSnap.data() as any;
          userEmail = d.email ?? "";
          userRole = d.role ?? "";
          userCreatedAt = d.createdAt?.toDate
            ? d.createdAt.toDate().toLocaleString("ja-JP")
            : undefined;

          userBaseProfile = {
            nickname: d.nickname ?? "",
            birthDate: d.birthDate ?? "",
            area: d.area ?? "",
            phoneNumber: d.phoneNumber ?? "",

            experienceLevel: d.experienceLevel ?? "none",
            experienceYears: d.experienceYears ?? "",
            experienceShops: d.experienceShops ?? "",
            averageSales: d.averageSales ?? "",
            maxSales: d.maxSales ?? "",

            currentJob: d.currentJob ?? "",
            residenceStation: d.residenceStation ?? "",

            preferredShift: d.preferredShift ?? "",
            preferredJobType: d.preferredJobType ?? "",
            preferredHourlyWage: d.preferredHourlyWage ?? "",
          };

          setUserDoc({ email: userEmail, role: userRole, createdAt: userCreatedAt });
        } else {
          setUserDoc(null);
        }

        // profiles/{id}
        const profileRef = doc(db, "profiles", userId);
        const profileSnap = await getDoc(profileRef);

        let profileData: any = {};
        let photos: string[] = [];
        let profileCreatedAt: string | undefined;

        if (profileSnap.exists()) {
          profileData = profileSnap.data() as any;

          if (Array.isArray(profileData.photoURLs)) photos = profileData.photoURLs;
          else if (Array.isArray(profileData.photos)) photos = profileData.photos;
          else if (Array.isArray(profileData.images)) photos = profileData.images;

          const single =
            profileData.iconUrl ||
            profileData.photoURL ||
            profileData.imageUrl ||
            profileData.avatarUrl ||
            undefined;

          if (!photos.length && single) photos = [single];

          profileCreatedAt = profileData.createdAt?.toDate
            ? profileData.createdAt.toDate().toLocaleString("ja-JP")
            : undefined;
        }

        // merge
        const merged: ProfileDoc = {
          nickname: userBaseProfile.nickname ?? "",
          birthDate: userBaseProfile.birthDate ?? "",
          area: userBaseProfile.area ?? "",
          phoneNumber: userBaseProfile.phoneNumber ?? "",

          experienceLevel: userBaseProfile.experienceLevel ?? "none",
          experienceYears: userBaseProfile.experienceYears ?? "",
          experienceShops: userBaseProfile.experienceShops ?? "",
          averageSales: userBaseProfile.averageSales ?? "",
          maxSales: userBaseProfile.maxSales ?? "",

          currentJob: userBaseProfile.currentJob ?? "",
          residenceStation: userBaseProfile.residenceStation ?? "",

          preferredShift: userBaseProfile.preferredShift ?? "",
          preferredJobType: userBaseProfile.preferredJobType ?? "",
          preferredHourlyWage: userBaseProfile.preferredHourlyWage ?? "",

          iconUrl: profileData.iconUrl ?? (profileData.photoURL || null) ?? null,
          selfIntro: profileData.selfIntro ?? profileData.introduction ?? "",
          status: profileData.status ?? "pending",
          adminMemo: profileData.adminMemo ?? "",
          photos,
          createdAt: profileCreatedAt ?? userCreatedAt,
        };

        setProfile(merged);

        // chatRooms
        const roomsRef = collection(db, "chatRooms");
        const qRooms = query(roomsRef, where("userId", "==", userId));
        const roomsSnap = await getDocs(qRooms);

        if (!roomsSnap.empty) {
          const docSnap = roomsSnap.docs[0];
          const d = docSnap.data() as any;
          setChatRoom({ roomId: docSnap.id, lastMessage: d.lastMessage ?? "" });
        } else {
          setChatRoom(null);
        }
      } catch (e) {
        console.error(e);
        setError("ユーザー情報の取得に失敗しました。");
      } finally {
        setLoadingAll(false);
      }
    };

    fetchAll();
  }, [userId, db]);

  const handleApprove = async () => {
    if (!confirm("このユーザーを承認しますか？")) return;
    try {
      await setUserRole(userId, "user");
      setProfile((p) => (p ? { ...p, status: "approved" } : p));
      setUserDoc((u) => (u ? { ...u, role: "user" } : u));
    } catch (e) {
      console.error(e);
      alert("承認に失敗しました");
    }
  };

  const handleReject = async () => {
    if (!confirm("このユーザーを却下しますか？")) return;
    try {
      await setUserRole(userId, "rejected");
      setProfile((p) => (p ? { ...p, status: "rejected" } : p));
      setUserDoc((u) => (u ? { ...u, role: "rejected" } : u));
    } catch (e) {
      console.error(e);
      alert("却下に失敗しました");
    }
  };

  const handleSuspend = async () => {
    if (!confirm("このユーザーを利用停止にしますか？\n※ログイン・利用ができなくなります")) {
      return;
    }

    try {
      await setUserRole(userId, "suspended");

      setUserDoc((u) => (u ? { ...u, role: "suspended" } : u));
      setProfile((p) => (p ? { ...p, status: "suspended" } : p));
    } catch (e) {
      console.error(e);
      alert("利用停止に失敗しました");
    }
  };


  const handleSaveAdminFields = async () => {
    if (!db) return;
    if (!profile) return;

    try {
      setSavingAdmin(true);
      setError(null);

      // 管理側で触るのは profiles 側のみ（事故防止）
      await setDoc(
        doc(db, "profiles", userId),
        {
          adminMemo: profile.adminMemo ?? "",
          status: profile.status ?? "pending",
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.error(e);
      setError("管理項目の保存に失敗しました。");
    } finally {
      setSavingAdmin(false);
    }
  };

  const statusLabel = (status?: string) => {
    switch (status) {
      case "pending":
        return "審査中";
      case "approved":
        return "承認済み";
      case "rejected":
        return "却下";
      case "suspended":
        return "利用停止";
      default:
        return "不明";
    }
  };

  const statusColor = (status?: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-300 border-yellow-400/60";
      case "approved":
        return "bg-emerald-500/10 text-emerald-300 border-emerald-400/60";
      case "rejected":
        return "bg-red-500/10 text-red-300 border-red-400/60";
      case "suspended":
        return "bg-red-500/10 text-red-300 border-red-400/60";
      default:
        return "bg-gray-500/10 text-gray-300 border-gray-400/60";
    }
  };

  if (loading || loadingAll) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        読み込み中です…
      </div>
    );
  }

  if (!userDoc && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        該当ユーザーが見つかりませんでした。
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white px-4 pb-10 pt-20 md:pt-24 relative overflow-hidden">
      {/* 背景 */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#050007]" />
        <div className="pointer-events-none absolute -left-24 -top-12 h-[180px] w-[180px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(236,72,153,0.2),_transparent_70%)] blur-[70px]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[220px] bg-[radial-gradient(circle_at_bottom,_rgba(129,140,248,0.16),_transparent_70%)] blur-[90px]" />
      </div>

      <main className="mx-auto w-full max-w-5xl space-y-6">
        {/* ヘッダー */}
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="text-[11px] text-pink-200 tracking-[0.16em] uppercase mb-1">
              USER DETAIL
            </p>
            <h1 className="text-2xl md:text-3xl font-bold">ユーザー詳細</h1>
            <p className="mt-1 text-xs text-gray-300">
              /mypage/edit と同じ項目構成でプロフィールを確認できます。
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 text-xs">
            <div
              className={`inline-flex items-center rounded-full border px-3 py-1 ${statusColor(
                profile?.status
              )}`}
            >
              <span className="mr-1 text-[10px]">ステータス</span>
              <span className="font-semibold">{statusLabel(profile?.status)}</span>
            </div>
            {userDoc?.role && (
              <p className="text-[11px] text-gray-300">
                role: <span className="font-mono">{userDoc.role}</span>
              </p>
            )}
          </div>
        </header>

        {error && (
          <p className="text-xs md:text-sm text-red-200 bg-red-500/10 border border-red-500/40 px-3 py-2 rounded-xl">
            {error}
          </p>
        )}

        {/* ✅ ここが “mypage/edit と一致するプロフィール表示” */}
        {profile && (
          <UserProfileView userDoc={profile} profileDoc={profile} />
        )}

        {/* 管理専用：運営メモ */}
          <section className="rounded-2xl border border-yellow-400/40 bg-yellow-500/5 px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.8)] space-y-2">
            <h2 className="text-sm font-semibold mb-1">
              運営メモ（店舗には公開されません）
            </h2>
            <textarea
              value={profile?.adminMemo ?? ""}
                onChange={(e) =>
                setProfile((p) => (p ? { ...p, adminMemo: e.target.value } : p))
              }
              rows={8}
              className="w-full rounded-md bg-black/40 border border-yellow-400/60 px-2 py-2 text-xs outline-none focus:border-pink-400"
              placeholder="面談メモ、注意点、紹介NG理由などを記録しておけます。"
            />
          </section>

        {/* システム情報＆アクション */}
        <section className="rounded-2xl border border-white/12 bg-[#08030f]/90 px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.8)] space-y-3 text-xs md:text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <p className="text-[11px] text-gray-400 mb-1">ユーザーID</p>
              <p className="font-mono break-all text-gray-100">{userId}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400 mb-1">メールアドレス</p>
              <p className="break-all text-gray-100">{userDoc?.email ?? "-"}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-400 mb-1">登録日時</p>
              <p className="text-gray-100">
                {profile?.createdAt || userDoc?.createdAt || "-"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3 mt-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSaveAdminFields}
                disabled={savingAdmin}
                className="px-3 py-1.5 rounded-full border border-pink-400 text-pink-200 text-[11px] md:text-xs hover:bg-pink-500/10 disabled:opacity-60"
              >
                {savingAdmin ? "保存中…" : "管理項目を保存"}
              </button>

              <button
                type="button"
                onClick={handleReject}
                className="px-3 py-1.5 rounded-full border border-white/30 text-gray-100 text-[11px] md:text-xs hover:bg-white/10"
              >
                却下
              </button>

              <button
                type="button"
                onClick={handleApprove}
                className="px-4 py-1.5 rounded-full bg-emerald-500 text-white text-[11px] md:text-xs hover:bg-emerald-600"
              >
                承認する
              </button>

              <button
                type="button"
                onClick={handleSuspend}
                className="px-3 py-1.5 rounded-full border border-red-400 text-red-200 text-[11px] md:text-xs hover:bg-red-500/10"
              >
                利用停止
              </button>
            </div>

            {chatRoom && (
              <button
                type="button"
                onClick={() => router.push(`/admin/chats/${chatRoom.roomId}`)}
                className="px-3 py-1.5 rounded-full bg-indigo-500 text-white text-[11px] md:text-xs hover:bg-indigo-600"
              >
                このユーザーとのチャットを開く
              </button>
            )}
          </div>
        </section>
      </main>

      {/* 画像拡大モーダル（必要なら UserProfileView 側に寄せてもOK） */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70"
          onClick={() => setSelectedImage(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={selectedImage}
            alt="拡大画像"
            className="max-h-[80vh] max-w-[90vw] rounded-xl border border-white/20"
          />
        </div>
      )}
    </div>
  );
}
