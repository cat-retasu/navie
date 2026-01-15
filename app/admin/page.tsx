// app/admin/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  getDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  getCountFromServer,
} from "firebase/firestore";

import { useAdminUnread } from "./layout"; // ✅ 追加：layout から未読総数を参照

type PendingUser = {
  id: string;
  email: string;
  nickname?: string;
  createdAt?: Date | null;
  preferredJobType?: string;
  preferredShift?: string;
  preferredHourlyWage?: string;
  experienceLevel?: string;
};

type RecentChat = {
  id: string;
  userId: string;
  lastMessage?: string;
  updatedAt?: Date | null;
  unreadCount?: number;
  role?: "pending" | "user" | "rejected" | "admin";
};

function formatDateTime(d?: Date | null) {
  if (!d) return "";
  return d.toLocaleString("ja-JP", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function StatCard({
  label,
  value,
  sub,
  href,
  accent = "pink",
}: {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
  accent?: "pink" | "indigo" | "emerald";
}) {
  const accentClasses =
    accent === "indigo"
      ? "from-indigo-500/30 to-transparent border-indigo-400/30"
      : accent === "emerald"
      ? "from-emerald-500/25 to-transparent border-emerald-400/25"
      : "from-pink-500/30 to-transparent border-pink-400/30";

  const inner = (
    <div
      className={cx(
        "relative overflow-hidden rounded-2xl border bg-white/[0.03] p-4",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.04)]",
        accentClasses
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-b opacity-60" />
      <div className="relative">
        <p className="text-[11px] text-gray-300">{label}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-white">
          {value}
        </p>
        {sub ? <p className="mt-1 text-[11px] text-gray-400">{sub}</p> : null}
      </div>
    </div>
  );

  if (!href) return inner;

  return (
    <Link
      href={href}
      className="block transition hover:-translate-y-[1px] hover:opacity-95"
    >
      {inner}
    </Link>
  );
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();

  // ✅ layout から “全体の未読総数” をもらう（ここでは再集計しない）
  const { unreadTotal } = useAdminUnread();
  const unreadCount = unreadTotal;

  // stats
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [userCount, setUserCount] = useState<number>(0);

  // lists
  const [pendingLatest, setPendingLatest] = useState<PendingUser[]>([]);
  const [chatLatest, setChatLatest] = useState<RecentChat[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // ✅ 管理者チェック（既存どおり）:contentReference[oaicite:5]{index=5}
  useEffect(() => {
    if (loading) return;
    if (!user || userData?.role !== "admin") {
      router.replace("/login");
    }
  }, [user, userData, loading, router]);

  // ✅ ① 承認待ち数 / 登録ユーザー数（Count）:contentReference[oaicite:6]{index=6}
  useEffect(() => {
    if (!user || userData?.role !== "admin") return;

    let cancelled = false;

    (async () => {
      try {
        const usersRef = collection(db, "users");

        // 全ユーザー数
        const totalSnap = await getCountFromServer(usersRef);
        if (!cancelled) setUserCount(totalSnap.data().count);

        // 承認待ち数
        const qPending = query(usersRef, where("role", "==", "pending"));
        const pendingSnap = await getCountFromServer(qPending);
        if (!cancelled) setPendingCount(pendingSnap.data().count);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setError("集計の取得に失敗しました（権限/インデックスを確認）");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, userData]);

  // ✅ ② 最新の承認待ち5件（リアルタイム）:contentReference[oaicite:7]{index=7}
  useEffect(() => {
    if (!user || userData?.role !== "admin") return;

    const usersRef = collection(db, "users");
    const qLatestPending = query(
      usersRef,
      where("role", "==", "pending"),
      orderBy("createdAt", "desc"),
      limit(5)
    );

    const unsub = onSnapshot(
      qLatestPending,
      (snap) => {
        const list: PendingUser[] = snap.docs.map((d) => {
          const data = d.data() as any;
          const ts = data.createdAt as Timestamp | undefined;
          const createdAt = ts?.toDate ? ts.toDate() : null;

          return {
            id: d.id,
            email: data.email ?? "",
            nickname: data.nickname ?? "",
            createdAt,
            preferredJobType: data.preferredJobType ?? "",
            preferredShift: data.preferredShift ?? "",
            preferredHourlyWage: data.preferredHourlyWage ?? "",
            experienceLevel: data.experienceLevel ?? "",
          };
        });
        setPendingLatest(list);
        setInitialLoading(false);
      },
      (err) => {
        console.error(err);
        setError("承認待ちユーザーの取得に失敗しました");
        setInitialLoading(false);
      }
    );

    return () => unsub();
  }, [user, userData]);

  // ✅ ③ 最新チャット5件 + “各ルーム未読”（※総未読は数えない：layout に一本化）
  useEffect(() => {
    if (!user || userData?.role !== "admin") return;

    const roomsRef = collection(db, "chatRooms");
    const qRooms = query(roomsRef, orderBy("updatedAt", "desc"), limit(5));

    const unsub = onSnapshot(
      qRooms,
      async (snap) => {
        try {
          const rooms: RecentChat[] = [];

          for (const d of snap.docs) {
            const data = d.data() as any;
            const ts = data.updatedAt as Timestamp | undefined;
            const updatedAt = ts?.toDate ? ts.toDate() : null;

            let role: RecentChat["role"] = "user";
            if (data.userId) {
              const userSnap = await getDoc(doc(db, "users", data.userId));
              if (userSnap.exists()) {
                role = (userSnap.data() as any).role ?? "user";
              }
            }

            rooms.push({
              id: d.id,
              userId: data.userId ?? "",
              lastMessage: data.lastMessage ?? "",
              updatedAt,
              unreadCount: 0,
              role,
            });
          }

          // 各ルームの未読（readByAdmin == false）だけ “軽く” 数える
          const withUnread = await Promise.all(
            rooms.map(async (r) => {
              const msgsRef = collection(db, "chatRooms", r.id, "messages");
              const qUnread = query(
                msgsRef,
                where("readByAdmin", "==", false)
                // 送信側が統一できてるなら追加推奨：
                // , where("from", "==", "user")
              );

              let c = 0;
              try {
                const cnt = await getCountFromServer(qUnread);
                c = cnt.data().count;
              } catch {
                const s = await getDocs(qUnread);
                c = s.size;
              }

              return { ...r, unreadCount: c };
            })
          );

          setChatLatest(withUnread);
        } catch (e) {
          console.error(e);
          setError("チャット情報の取得に失敗しました");
        }
      },
      (err) => {
        console.error(err);
        setError("チャットルームの購読に失敗しました");
      }
    );

    return () => unsub();
  }, [user, userData]);

  const unreadRooms = useMemo(() => {
    return chatLatest.filter((x) => (x.unreadCount ?? 0) > 0).length;
  }, [chatLatest]);

  return (
    <div className="min-h-screen bg-[#050007] text-white overflow-x-hidden">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6">
        {/* header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              管理ダッシュボード
            </h1>
            <p className="mt-1 text-[12px] text-gray-300">
              承認・チャット対応を一気に回すための一覧です
            </p>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 -mx-1 px-1">
  <Link
    href="/admin/users/pending"
    className="shrink-0 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-[12px] text-gray-100 transition hover:bg-white/[0.07]"
  >
    承認待ちを見る
  </Link>
  <Link
    href="/admin/chats"
    className="shrink-0 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-[12px] text-gray-100 transition hover:bg-white/[0.07]"
  >
    チャット一覧へ
  </Link>
  <Link
    href="/admin/quick-replies"
    className="shrink-0 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-[12px] text-gray-100 transition hover:bg-white/[0.07]"
  >
    定型文
  </Link>
  <Link
    href="/admin/users"
    className="shrink-0 rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-[12px] text-gray-100 transition hover:bg-white/[0.07]"
  >
    ユーザー一覧
  </Link>
</div>
        </div>

        {error ? (
          <div className="mb-5 rounded-2xl border border-pink-500/30 bg-pink-500/10 px-4 py-3 text-[12px] text-pink-200">
            {error}
          </div>
        ) : null}

        {/* stats */}
        <div className="grid gap-3 md:grid-cols-3">
          <StatCard
            label="承認待ち数"
            value={pendingCount}
            sub="新規登録の審査が必要"
            href="/admin/users/pending"
            accent="pink"
          />
          <StatCard
            label="未読チャット数"
            value={unreadTotal} // ✅ ここが “layout の総数”
            sub={`未読ありルーム：${unreadRooms}件`}
            href="/admin/chats"
            accent="indigo"
          />
          <StatCard
            label="登録ユーザー数"
            value={userCount}
            sub="users コレクション総数"
            href="/admin/users"
            accent="emerald"
          />
        </div>

        {/* lists */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {/* pending latest */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">最新の承認待ち（5件）</p>
              <Link
                href="/admin/users/pending"
                className="text-[11px] text-gray-300 hover:text-pink-200 underline underline-offset-2"
              >
                もっと見る
              </Link>
            </div>

            {pendingLatest.length === 0 ? (
              <p className="text-[12px] text-gray-400">
                承認待ちユーザーはありません
              </p>
            ) : (
              <div className="space-y-2">
                {pendingLatest.map((u) => (
                  <Link
                    key={u.id}
                    href={`/admin/users/${u.id}`}
                    className="block rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 transition hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {u.nickname || "（ニックネーム未設定）"}
                        </p>
                        <p className="truncate text-[11px] text-gray-400">
                          {u.email}
                        </p>
                      </div>
                      <p className="shrink-0 text-[11px] text-gray-400">
                        {formatDateTime(u.createdAt)}
                      </p>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {u.experienceLevel ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-[2px] text-[10px] text-gray-200">
                          経験: {u.experienceLevel}
                        </span>
                      ) : null}
                      {u.preferredJobType ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-[2px] text-[10px] text-gray-200">
                          希望: {u.preferredJobType}
                        </span>
                      ) : null}
                      {u.preferredHourlyWage ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-[2px] text-[10px] text-gray-200">
                          時給: {u.preferredHourlyWage}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* chat latest */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">最新チャット（5件）</p>
              <Link
                href="/admin/chats"
                className="text-[11px] text-gray-300 hover:text-pink-200 underline underline-offset-2"
              >
                一覧へ
              </Link>
            </div>

            {chatLatest.length === 0 ? (
              <p className="text-[12px] text-gray-400">
                チャットルームがありません
              </p>
            ) : (
              <div className="space-y-2">
                {chatLatest.map((r) => (
                  <Link
                    key={r.id}
                    href={`/admin/chats/${r.id}`}
                    className="block rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 transition hover:bg-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-all text-[11px] text-gray-400">
  room: {r.id}
</p>
                        <p className="truncate text-sm">
                          {r.lastMessage || "（メッセージなし）"}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-[11px] text-gray-400">
                          {formatDateTime(r.updatedAt)}
                        </p>

                        {(r.unreadCount ?? 0) > 0 ? (
                          <p className="mt-1 inline-flex items-center rounded-full bg-pink-500/20 border border-pink-300/50 px-2 py-[1px] text-[11px] text-pink-100">
                            未読 {r.unreadCount! > 9 ? "9+" : r.unreadCount}
                          </p>
                        ) : (
                          <p className="mt-1 text-[11px] text-gray-500">既読</p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {initialLoading ? (
          <p className="mt-6 text-center text-[12px] text-gray-400">
            読み込み中…
          </p>
        ) : null}
      </div>
    </div>
  );
}
