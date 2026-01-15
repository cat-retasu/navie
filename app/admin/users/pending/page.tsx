//app/admin/users/pending/page.tsx

"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  doc,
  updateDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { setUserRole } from "@/lib/setUserRole";

type PendingUser = {
  id: string;
  email: string;
  nickname?: string;
  role: string;
  createdAt?: Date | null;
  area?: string;
  experienceLevel?: string;
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

const formatDateTime = (d?: Date | null) => {
  if (!d) return "";
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function PendingUsersPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [selected, setSelected] = useState<PendingUser | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // 管理者チェック（admin以外はログイン画面へ）
  useEffect(() => {
    if (loading) return;
    if (!user || userData?.role !== "admin") {
      router.replace("/login");
    }
  }, [user, userData, loading, router]);

  // pendingユーザー一覧をリアルタイム取得
  useEffect(() => {
    const usersRef = collection(db, "users");
    const q = query(
      usersRef,
      where("role", "==", "pending"), // ここで role=pending をちゃんと拾う
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: PendingUser[] = snap.docs.map((d) => {
          const data = d.data() as any;
          let createdAt: Date | null = null;
          const ts = data.createdAt as Timestamp | undefined;
          if (ts?.toDate) createdAt = ts.toDate();

          return {
            id: d.id,
            email: data.email ?? "",
            nickname: data.nickname ?? "",
            role: data.role ?? "pending",
            createdAt,
            area: data.area ?? "",
            experienceLevel: data.experienceLevel ?? "",
            experienceYears: data.experienceYears ?? "",
            experienceShops: data.experienceShops ?? "",
            averageSales: data.averageSales ?? "",
            maxSales: data.maxSales ?? "",
            currentJob: data.currentJob ?? "",
            residenceStation: data.residenceStation ?? "",
            preferredShift: data.preferredShift ?? "",
            preferredJobType: data.preferredJobType ?? "",
            preferredHourlyWage: data.preferredHourlyWage ?? "",
          };
        });
        setPendingUsers(list);
        setInitialLoading(false);
      },
      (err) => {
        console.error(err);
        setError("承認待ちユーザーの取得に失敗しました。");
        setInitialLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleApprove = async (userId: string) => {
  setProcessingId(userId);
  setError(null);
  try {
    await setUserRole(userId, "user");
    setSelected(null);
  } catch (e) {
    console.error(e);
    setError("承認に失敗しました。もう一度お試しください。");
  } finally {
    setProcessingId(null);
  }
};

const handleReject = async (userId: string) => {
  if (!confirm("このユーザーを却下しますか？")) return;

  setProcessingId(userId);
  setError(null);
  try {
    await setUserRole(userId, "rejected");
    setSelected(null);
  } catch (e) {
    console.error(e);
    setError("却下に失敗しました。もう一度お試しください。");
  } finally {
    setProcessingId(null);
  }
};

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 text-white">
      {/* 夜ナビっぽい背景 */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#050007]" />
        <div className="absolute -left-24 -top-16 h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(236,72,153,0.22),_transparent_70%)] blur-[80px]" />
        <div className="absolute inset-x-0 bottom-0 h-[260px] bg-[radial-gradient(circle_at_bottom,_rgba(129,140,248,0.18),_transparent_70%)] blur-[90px]" />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        {/* ヘッダー */}
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] text-pink-200 mb-1">
              ADMIN &nbsp; / &nbsp; PENDING USERS
            </p>
            <h1 className="text-xl md:text-2xl font-bold">
              承認待ちユーザー管理
            </h1>
            <p className="mt-1 text-xs text-gray-400">
              新規登録されたユーザーのプロフィールを確認して、承認・却下を行えます。
            </p>
          </div>
          <div className="mt-2 md:mt-0 text-xs text-gray-300">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
              承認待ち：{pendingUsers.length}件
            </span>
          </div>
        </header>

        {/* エラー */}
        {error && (
          <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        {/* 一覧カード */}
        <section className="rounded-[24px] border border-white/10 bg-[#08030f]/95 shadow-[0_20px_60px_rgba(0,0,0,0.7)] p-4 md:p-5">
          {initialLoading ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-xs text-gray-400">読み込み中です…</p>
            </div>
          ) : pendingUsers.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-1">
              <p className="text-sm text-gray-200">
                承認待ちのユーザーはいません。
              </p>
              <p className="text-[11px] text-gray-400">
                新規登録が行われると、ここに表示されます。
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {pendingUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelected(u)}
                  className="group flex flex-col items-start rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition hover:border-pink-400/80 hover:bg-white/[0.07]"
                >
                  <div className="mb-1 flex w-full items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-white">
                      {u.nickname || "（ニックネーム未設定）"}
                    </span>
                    <span className="rounded-full bg-pink-500/15 px-2 py-0.5 text-[10px] text-pink-200">
                      承認待ち
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-gray-300">
                    {u.email}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-gray-300">
                    {u.preferredJobType && (
                      <span className="rounded-full border border-white/15 px-2 py-0.5">
                        希望：{u.preferredJobType}
                      </span>
                    )}
                    {u.preferredShift && (
                      <span className="rounded-full border border-white/15 px-2 py-0.5">
                        シフト：{u.preferredShift}
                      </span>
                    )}
                    {u.preferredHourlyWage && (
                      <span className="rounded-full border border-white/15 px-2 py-0.5">
                        時給：¥{u.preferredHourlyWage}
                      </span>
                    )}
                    {u.experienceLevel && (
                      <span className="rounded-full border border-white/15 px-2 py-0.5">
                        経験：{u.experienceLevel}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[10px] text-gray-400">
                    登録日：{formatDateTime(u.createdAt)}
                  </p>
                  <p className="mt-1 text-[10px] text-pink-200 opacity-0 transition group-hover:opacity-100">
                    詳細を見る →
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 詳細モーダル */}
      {selected && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-[#070313] p-4 md:p-5 shadow-[0_24px_80px_rgba(0,0,0,0.85)]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-pink-200 mb-1">
                  USER PROFILE PREVIEW
                </p>
                <h2 className="text-lg font-semibold">
                  {selected.nickname || "ニックネーム未設定"}
                </h2>
                <p className="text-[11px] text-gray-300">
                  {selected.email}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-full border border-white/20 bg-white/5 px-2 py-1 text-xs text-gray-200 hover:border-pink-400 hover:text-pink-200"
              >
                閉じる
              </button>
            </div>

            <div className="space-y-1.5 text-[12px] text-gray-100 max-h-[55vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-[90px,1fr] gap-x-3 gap-y-1">
                <span className="text-gray-400">登録日時</span>
                <span>{formatDateTime(selected.createdAt)}</span>

                <span className="text-gray-400">エリア</span>
                <span>{selected.area || "未入力"}</span>

                <span className="text-gray-400">現職</span>
                <span>{selected.currentJob || "未入力"}</span>

                <span className="text-gray-400">最寄駅</span>
                <span>{selected.residenceStation || "未入力"}</span>

                <span className="text-gray-400">経験</span>
                <span>{selected.experienceLevel || "未入力"}</span>

                <span className="text-gray-400">経験年数</span>
                <span>{selected.experienceYears || "未入力"}</span>

                <span className="text-gray-400">在籍店</span>
                <span>{selected.experienceShops || "未入力"}</span>

                <span className="text-gray-400">平均売上</span>
                <span>{selected.averageSales || "未入力"}</span>

                <span className="text-gray-400">最高売上</span>
                <span>{selected.maxSales || "未入力"}</span>

                <span className="text-gray-400">希望シフト</span>
                <span>{selected.preferredShift || "未入力"}</span>

                <span className="text-gray-400">希望業種</span>
                <span>{selected.preferredJobType || "未入力"}</span>

                <span className="text-gray-400">希望時給</span>
                <span>
                  {selected.preferredHourlyWage
                    ? `¥${selected.preferredHourlyWage}`
                    : "未入力"}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 md:flex-row md:justify-end">
              <button
                type="button"
                onClick={() => handleReject(selected.id)}
                disabled={processingId === selected.id}
                className="w-full rounded-full border border-red-400/70 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-100 hover:bg-red-500/25 disabled:opacity-60 md:w-auto"
              >
                {processingId === selected.id ? "処理中…" : "却下する"}
              </button>
              <button
                type="button"
                onClick={() => handleApprove(selected.id)}
                disabled={processingId === selected.id}
                className="w-full rounded-full bg-[#ff2f92] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(236,72,153,0.7)] hover:bg-[#ff4a9f] disabled:opacity-60 md:w-auto"
              >
                {processingId === selected.id ? "処理中…" : "承認して登録"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}