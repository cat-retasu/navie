//app/admin/users/page.tsx

"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/AuthProvider";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";

type AdminUser = {
  id: string;
  email: string;
  nickname?: string;
  role: string;
  createdAt?: Date | null;
  area?: string;
  experienceLevel?: string;
  preferredShift?: string;
  preferredJobType?: string;
  preferredHourlyWage?: string;
};

const formatDateTime = (d?: Date | null) => {
  if (!d) return "";
  return d.toLocaleString("ja-JP", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getRoleChip = (role: string) => {
  switch (role) {
    case "admin":
      return {
        label: "管理者",
        className:
          "bg-indigo-500/20 text-indigo-100 border border-indigo-300/60",
      };
    case "pending":
      return {
        label: "承認待ち",
        className:
          "bg-pink-500/20 text-pink-100 border border-pink-300/70",
      };
    case "rejected":
      return {
        label: "却下",
        className:
          "bg-red-500/20 text-red-100 border border-red-300/70",
      };
    case "user":
    default:
      return {
        label: "ユーザー",
        className:
          "bg-white/10 text-gray-100 border border-white/25",
      };
  }
};

export default function AdminUsersPage() {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const [roleFilter, setRoleFilter] = useState<
    "all" | "pending" | "user" | "admin" | "rejected"
  >("all");
  const [search, setSearch] = useState("");

  // 管理者チェック
  useEffect(() => {
    if (loading) return;
    if (!user || userData?.role !== "admin") {
      router.replace("/login");
    }
  }, [user, userData, loading, router]);

  // ユーザー一覧取得
  useEffect(() => {
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: AdminUser[] = snap.docs.map((d) => {
          const data = d.data() as any;
          let createdAt: Date | null = null;
          const ts = data.createdAt as Timestamp | undefined;
          if (ts?.toDate) createdAt = ts.toDate();

          return {
            id: d.id,
            email: data.email ?? "",
            nickname: data.nickname ?? "",
            role: data.role ?? "user",
            createdAt,
            area: data.area ?? "",
            experienceLevel: data.experienceLevel ?? "",
            preferredShift: data.preferredShift ?? "",
            preferredJobType: data.preferredJobType ?? "",
            preferredHourlyWage: data.preferredHourlyWage ?? "",
          };
        });
        setUsers(list);
        setInitialLoading(false);
      },
      (err) => {
        console.error(err);
        setError("ユーザー一覧の取得に失敗しました。");
        setInitialLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (!search.trim()) return true;
      const w = search.trim().toLowerCase();
      return (
        (u.nickname ?? "").toLowerCase().includes(w) ||
        (u.email ?? "").toLowerCase().includes(w)
      );
    });
  }, [users, roleFilter, search]);

  const countByRole = useMemo(() => {
    const base = { all: users.length, pending: 0, user: 0, admin: 0, rejected: 0 };
    for (const u of users) {
      if (u.role === "pending") base.pending++;
      else if (u.role === "admin") base.admin++;
      else if (u.role === "rejected") base.rejected++;
      else base.user++;
    }
    return base;
  }, [users]);

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 text-white">
      {/* 夜ナビ背景 */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-[#050007]" />
        <div className="absolute -left-24 -top-16 h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(236,72,153,0.22),_transparent_70%)] blur-[80px]" />
        <div className="absolute inset-x-0 bottom-0 h-[260px] bg-[radial-gradient(circle_at_bottom,_rgba(129,140,248,0.18),_transparent_70%)] blur-[90px]" />
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        {/* ヘッダー */}
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-1 text-[11px] text-pink-200">
              ADMIN &nbsp;/&nbsp; USERS
            </p>
            <h1 className="text-xl font-bold md:text-2xl">
              ユーザー一覧管理
            </h1>
            <p className="mt-1 text-xs text-gray-400">
              登録済みユーザーのステータスや希望条件を確認し、詳細画面から編集できます。
            </p>
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-200 md:mt-0 md:justify-end">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
              合計：{countByRole.all}人
            </span>
            <span className="rounded-full border border-pink-300/70 bg-pink-500/15 px-3 py-1 text-pink-100">
              承認待ち：{countByRole.pending}人
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1">
              ユーザー：{countByRole.user}人
            </span>
            <span className="rounded-full border border-indigo-300/70 bg-indigo-500/20 px-3 py-1 text-indigo-100">
              管理者：{countByRole.admin}人
            </span>
          </div>
        </header>

        {/* エラー */}
        {error && (
          <div className="rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </div>
        )}

        {/* フィルタ＆検索 */}
        <section className="rounded-[20px] border border-white/10 bg-[#08030f]/95 p-3 text-xs shadow-[0_16px_40px_rgba(0,0,0,0.7)] md:p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                { key: "all", label: "すべて" },
                { key: "pending", label: "承認待ち" },
                { key: "user", label: "ユーザー" },
                { key: "admin", label: "管理者" },
                { key: "rejected", label: "却下" },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() =>
                    setRoleFilter(
                      f.key as
                        | "all"
                        | "pending"
                        | "user"
                        | "admin"
                        | "rejected"
                    )
                  }
                  className={`rounded-full border px-3 py-1 transition ${
                    roleFilter === f.key
                      ? "border-pink-400 bg-pink-500/20 text-pink-100"
                      : "border-white/20 bg-white/5 text-gray-200 hover:border-pink-300/60 hover:text-pink-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                className="w-40 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-xs text-gray-100 outline-none placeholder:text-gray-500 focus:border-pink-400 md:w-56"
                placeholder="ニックネーム/メールで検索"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* 一覧カード */}
        <section className="rounded-[24px] border border-white/10 bg-[#08030f]/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.75)] md:p-5">
          {initialLoading ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-xs text-gray-400">読み込み中です…</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-1">
              <p className="text-sm text-gray-200">
                条件に合致するユーザーがいません。
              </p>
              <p className="text-[11px] text-gray-400">
                フィルタや検索条件を変更して再度お試しください。
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {filteredUsers.map((u) => {
                const roleChip = getRoleChip(u.role);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => router.push(`/admin/users/${u.id}`)}
                    className="group flex flex-col items-start rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition hover:border-pink-400/80 hover:bg-white/[0.07]"
                  >
                    <div className="mb-1 flex w-full items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-white">
                        {u.nickname || "（ニックネーム未設定）"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${roleChip.className}`}
                      >
                        {roleChip.label}
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
                      {u.area && (
                        <span className="rounded-full border border-white/15 px-2 py-0.5">
                          エリア：{u.area}
                        </span>
                      )}
                    </div>

                    <p className="mt-2 text-[10px] text-gray-400">
                      登録：{formatDateTime(u.createdAt)}
                    </p>
                    <p className="mt-1 text-[10px] text-pink-200 opacity-0 transition group-hover:opacity-100">
                      詳細を見る →
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}