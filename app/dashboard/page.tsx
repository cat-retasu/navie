// app/dashboard/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getDbClient } from "@/lib/firebase";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import NavieBg from "@/components/NavieBg";
import NavieButton from "@/components/NavieButton";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type RoomInfo = {
  id: string;
  userId: string;
  updatedAt?: Date | null;
  lastMessage?: string;
  lastSender?: string;
};

type QuickLinkItem = {
  href: string;
  title: string;
  desc: string;
};

function NomiCard({
  label,
  title,
  children,
  className,
}: {
  label: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("nomi-card p-6 md:p-7", className)}>
      <p className="text-[11px] font-semibold tracking-[0.14em]" style={{ color: "var(--pink)" }}>
        {label}
      </p>
      <h2 className="mt-2 text-[15px] font-semibold text-[#0f0f12]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function QuickLinks({ items }: { items: QuickLinkItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className="block rounded-2xl border border-black/10 bg-white/70 px-4 py-3 hover:bg-white transition"
        >
          <p className="text-[12px] font-semibold text-[#0f0f12]">{it.title}</p>
          <p className="mt-1 text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
            {it.desc}
          </p>
        </Link>
      ))}
    </div>
  );
}

function HeaderActionLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[12px] font-semibold hover:bg-white transition"
      style={{ color: "var(--muted)" }}
    >
      {children}
    </Link>
  );
}

function HeaderActionButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[12px] font-semibold hover:bg-white transition"
      style={{ color: "var(--muted)" }}
    >
      {children}
    </button>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const db = useMemo(() => getDbClient(), []);
  const { user, userData, loading, logout } = useAuth();

  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [unread, setUnread] = useState<number>(0);
  const [unreadCap, setUnreadCap] = useState(false);

  const extra: any = userData ?? {};

  // ロールガード（mypage/chatと揃える）
  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (userData?.role === "suspended") {
      router.replace("/suspended");
      return;
    }

    if (userData?.role === "admin") {
      router.replace("/admin");
      return;
    }

    if (userData?.role === "pending") {
      router.replace("/pending");
      return;
    }
  }, [user, userData, loading, router]);

  // 自分のルームを取得（なければ null のまま。チャットページ側で作成される）
  useEffect(() => {
    if (!user || !db) return;

    (async () => {
      const q = query(
        collection(db, "chatRooms"),
        where("userId", "==", user.uid),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setRoom(null);
        return;
      }
      const d = snap.docs[0];
      const data = d.data() as any;
      setRoom({
        id: d.id,
        userId: data.userId ?? user.uid,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
        lastMessage: data.lastMessage ?? "",
        lastSender: data.lastSender ?? "",
      });
    })();
  }, [user, db]);

  // ルーム最新情報を購読（lastMessage / updatedAt）
  useEffect(() => {
    if (!db || !room?.id) return;

    const refRoom = doc(db, "chatRooms", room.id);
    const unsub = onSnapshot(refRoom, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as any;
      setRoom((prev) => ({
        id: prev?.id ?? snap.id,
        userId: data.userId ?? prev?.userId ?? "",
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
        lastMessage: data.lastMessage ?? "",
        lastSender: data.lastSender ?? "",
      }));
    });

    return () => unsub();
  }, [db, room?.id]);

  // admin→user の未読を購読（readByUser=false）
  // ※大量になる可能性があるので50件で打ち切って「50+」表記
  useEffect(() => {
    if (!db || !room?.id) return;

    const msgsRef = collection(db, "chatRooms", room.id, "messages");
    const q = query(
      msgsRef,
      where("readByUser", "==", false),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => d.data() as any);
      const adminUnread = docs.filter(
        (m) => (m.from ?? m.sender) === "admin" && m.isDeleted !== true
      );
      setUnread(adminUnread.length);
      setUnreadCap(snap.size >= 50 && adminUnread.length >= 50);
    });

    return () => unsub();
  }, [db, room?.id]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const isLoadingAll = loading || !user || !userData;

  // 入力ざっくり進捗（必須にしたい項目だけ数える）
  const progress = useMemo(() => {
    const requiredKeys: Array<[string, string]> = [
      ["nickname", "ニックネーム"],
      ["area", "希望エリア"],
      ["preferredJobType", "希望業種"],
      ["preferredShift", "希望シフト"],
      ["preferredHourlyWage", "希望時給"],
    ];

    const filled = requiredKeys.filter(([k]) => {
      const v = extra?.[k];
      return typeof v === "string" ? v.trim().length > 0 : !!v;
    }).length;

    const total = requiredKeys.length;
    const pct = Math.round((filled / total) * 100);

    return { filled, total, pct };
  }, [extra]);

  const updatedLabel = useMemo(() => {
    const d = room?.updatedAt;
    if (!d) return "未更新";
    return d.toLocaleString("ja-JP", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [room?.updatedAt]);

  const quickItems: QuickLinkItem[] = useMemo(
    () => [
      {
        href: "/schedule",
        title: "スケジュールを確認",
        desc: "出勤可能な時間や希望を整理",
      },
      {
        href: "/mypage",
        title: "プロフィールを確認",
        desc: "登録内容の確認・紹介に使われます",
      },
      {
        href: "/mypage/edit",
        title: "条件を更新",
        desc: "希望が変わったらここ",
      },
      // /chat は上の CHAT カードに集約して重複導線を削る
    ],
    []
  );

  if (isLoadingAll) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-[#0f0f12]">
        <div className="nomi-card px-5 py-4 text-sm" style={{ color: "var(--muted)" }}>
          読み込み中…
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen text-[#0f0f12] relative overflow-hidden">
      <NavieBg />
      <div aria-hidden className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(1200px 720px at 18% 12%, rgba(255,59,122,0.14), transparent 62%),
              radial-gradient(900px 640px at 88% 28%, rgba(255,208,223,0.42), transparent 62%),
              radial-gradient(1000px 760px at 50% 110%, rgba(255,59,122,0.10), transparent 62%),
              linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,249,251,1) 48%, rgba(255,255,255,1) 100%)
            `,
          }}
        />
        <div className="pointer-events-none absolute inset-0 nomi-dots" />
        <div className="pointer-events-none absolute inset-0 navie-grain" />
      </div>

      <div className="mx-auto w-full px-4 pb-12 pt-16 md:pt-20">
        <div
          className={cx(
            "mx-auto w-full max-w-5xl",
            "md:rounded-[44px] md:border md:border-[rgba(255,59,122,0.18)]",
            "md:bg-white/55 md:backdrop-blur-[14px]",
            "md:shadow-[0_26px_90px_rgba(18,18,24,0.14)]",
            "md:p-6 lg:p-8",
            "md:relative md:overflow-hidden"
          )}
        >
          <div
            aria-hidden
            className="hidden md:block absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(900px 420px at 20% 10%, rgba(255,255,255,0.55), transparent 60%)",
            }}
          />

          <div className="relative">
            {/* Header */}
            <header className="mb-6">
              <div className="flex items-center justify-between gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-[12px] font-semibold"
                  style={{ color: "var(--muted)" }}
                >
                  <span className="h-7 w-7 rounded-full border border-black/10 bg-white/70 backdrop-blur-[10px] flex items-center justify-center">
                    <span className="text-[12px]" style={{ color: "var(--pink)" }}>
                      N
                    </span>
                  </span>
                  NAVIÉ
                </Link>

                <div className="flex items-center gap-2">
                  <HeaderActionButton onClick={handleLogout}>ログアウト</HeaderActionButton>
                </div>
              </div>

              <p className="mt-5 text-[11px] font-semibold tracking-[0.18em]" style={{ color: "var(--pink)" }}>
                DASHBOARD
              </p>
              <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-[#0f0f12]">
                ようこそ、{extra.nickname || "NAVIÉ"}へ
              </h1>
              <p className="mt-2 text-xs md:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                次にやることを最短で。プロフィールと相談がここからすぐ行けます。
              </p>
            </header>

            {/* Top actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <NomiCard label="PROFILE" title="入力の進捗">
                <div className="flex items-end justify-between">
                  <p className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
                    {progress.filled}/{progress.total} 項目
                  </p>
                  <p className="text-[12px] font-semibold" style={{ color: "var(--pink)" }}>
                    {progress.pct}%
                  </p>
                </div>

                <div className="mt-2 h-2 w-full rounded-full bg-black/10 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${progress.pct}%`,
                      background:
                        "linear-gradient(135deg, #FF2F72 0%, #FF5B8D 55%, #FF9DB8 100%)",
                    }}
                  />
                </div>

                <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "rgba(95,96,107,0.85)" }}>
                  入力が多いほど紹介の精度が上がります。
                </p>

                <div className="mt-4">
                  <NavieButton href="/mypage/edit" className="w-full justify-center">
                    プロフィールを編集する
                  </NavieButton>
                </div>
              </NomiCard>

              <NomiCard label="CHAT" title="運営との相談">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
                    未読
                  </p>
                  <div
                    className={cx(
                      "inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold",
                      unread > 0
                        ? "border border-[rgba(255,59,122,0.35)] bg-[rgba(255,59,122,0.10)]"
                        : "border border-black/10 bg-white/70"
                    )}
                    style={{ color: unread > 0 ? "var(--pink)" : "rgba(95,96,107,0.85)" }}
                  >
                    {unreadCap ? "50+" : unread}
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                    最終更新：{updatedLabel}
                  </p>
                  <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>
                    {room?.lastMessage
                      ? `「${room.lastMessage}」`
                      : "まだメッセージがありません。気軽に一言からどうぞ。"}
                  </p>
                </div>

                <div className="mt-4">
                  <NavieButton href="/chat" className="w-full justify-center">
                    チャットを開く
                  </NavieButton>
                </div>

                <p className="mt-3 text-[10px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                  ※ 相談はここからいつでもOK
                </p>
              </NomiCard>

              <NomiCard label="QUICK" title="よく使う">
                <QuickLinks items={quickItems} />
              </NomiCard>
            </div>

            {/* Bottom note */}
            <section className="mt-6 nomi-card p-6 md:p-7">
              <p className="text-[11px] font-semibold tracking-[0.18em]" style={{ color: "var(--pink)" }}>
                TIPS
              </p>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
                紹介精度を上げたいなら「希望条件」と「経験」の入力が効きます。
                スケジュールも入れておくと提案が早くなります。迷ったらチャットで相談してOK。
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
