// app/requests/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getDbClient } from "@/lib/firebase";
import NavieBg from "@/components/NavieBg";
import NavieButton from "@/components/NavieButton";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

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
      <p
        className="text-[11px] font-semibold tracking-[0.14em]"
        style={{ color: "var(--pink)" }}
      >
        {label}
      </p>
      <h2 className="mt-2 text-[15px] font-semibold text-[#0f0f12]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

type RequestType = "interview" | "trial" | "other";
type RequestStatus = "open" | "scheduled" | "closed";

type ReqRow = {
  id: string;
  userId: string;
  type: RequestType;
  status: RequestStatus;
  memo: string;
  candidates: Array<{ startAt: Date; endAt: Date | null; note: string }>;
  createdAt: Date | null;
  chosenIndex?: number | null;
  scheduledEventId?: string | null;
};

function fmtDateTime(d: Date) {
  return d.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RequestsPage() {
  const router = useRouter();
  const db = useMemo(() => getDbClient(), []);
  const { user, userData, loading } = useAuth();

  // admin guard
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
    if (userData?.role !== "admin") {
      router.replace("/dashboard");
      return;
    }
  }, [user, userData, loading, router]);

  const isLoadingAll = loading || !user || !userData;

  const [tab, setTab] = useState<"open" | "scheduled">("open");

  const [rows, setRows] = useState<ReqRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  // list requests
  useEffect(() => {
    if (!db || !user) return;

    const qy = query(
      collection(db, "requests"),
      where("status", "==", tab === "open" ? "open" : "scheduled"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(qy, (snap) => {
      const list: ReqRow[] = snap.docs.map((d) => {
        const data = d.data() as any;
        const candidates = Array.isArray(data.candidates)
          ? data.candidates.map((c: any) => ({
              startAt: c?.startAt?.toDate ? c.startAt.toDate() : new Date(),
              endAt: c?.endAt?.toDate ? c.endAt.toDate() : null,
              note: c?.note ?? "",
            }))
          : [];
        return {
          id: d.id,
          userId: data.userId,
          type: data.type ?? "other",
          status: data.status ?? "open",
          memo: data.memo ?? "",
          candidates,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
          chosenIndex: data.chosenIndex ?? null,
          scheduledEventId: data.scheduledEventId ?? null,
        };
      });

      setRows(list);
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
      if (selectedId && !list.some((x) => x.id === selectedId)) setSelectedId(list[0]?.id ?? null);
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, user, tab]);

  // user info
  const [userInfo, setUserInfo] = useState<{ nickname?: string; area?: string; phone?: string } | null>(null);
  useEffect(() => {
    if (!db || !selected?.userId) {
      setUserInfo(null);
      return;
    }
    (async () => {
      const uref = doc(db, "users", selected.userId);
      const snap = await getDoc(uref);
      if (!snap.exists()) {
        setUserInfo(null);
        return;
      }
      const data = snap.data() as any;
      setUserInfo({
        nickname: data.nickname ?? "",
        area: data.area ?? "",
        phone: data.phoneNumber ?? data.phone ?? "",
      });
    })();
  }, [db, selected?.userId]);

  // confirm -> create schedule
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // 選択変更時にフォームを軽く初期化
    setTitle("");
    setLocation("");
    setMemo("");
  }, [selectedId]);

  const confirmCandidate = async (candidateIndex: number) => {
    if (!db || !user || !selected) return;
    const c = selected.candidates[candidateIndex];
    if (!c) return;

    const defaultTitle =
      title.trim() ||
      (selected.type === "interview" ? "面接" : selected.type === "trial" ? "体験入店" : "予定");
    if (!defaultTitle) return alert("タイトルを入れてね");

    setSaving(true);
    try {
      // 1) schedule 作成
      const scheduleRef = await addDoc(collection(db, "schedules"), {
        userId: selected.userId,
        type: selected.type === "trial" ? "trial" : selected.type === "interview" ? "interview" : "other",
        title: defaultTitle,
        startAt: Timestamp.fromDate(c.startAt),
        endAt: c.endAt ? Timestamp.fromDate(c.endAt) : null,
        location: location.trim(),
        memo: (memo || selected.memo || "").trim(),
        status: "confirmed",
        createdBy: "admin",
        adminId: user.uid,
        requestId: selected.id,
        isDeleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2) request 更新
      await updateDoc(doc(db, "requests", selected.id), {
        status: "scheduled",
        chosenIndex: candidateIndex,
        scheduledEventId: scheduleRef.id,
        updatedAt: serverTimestamp(),
      });

      alert("日程を確定してスケジュールを作成したよ！");
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "確定に失敗した…");
    } finally {
      setSaving(false);
    }
  };

  const closeRequest = async () => {
    if (!db || !selected) return;
    if (!confirm("このリクエストをクローズする？")) return;
    await updateDoc(doc(db, "requests", selected.id), {
      status: "closed",
      updatedAt: serverTimestamp(),
    });
  };

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
            "mx-auto w-full max-w-6xl",
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
                  href="/admin"
                  className="inline-flex items-center gap-2 text-[12px] font-semibold"
                  style={{ color: "var(--muted)" }}
                >
                  <span className="h-7 w-7 rounded-full border border-black/10 bg-white/70 backdrop-blur-[10px] flex items-center justify-center">
                    <span className="text-[12px]" style={{ color: "var(--pink)" }}>
                      ←
                    </span>
                  </span>
                  管理画面へ
                </Link>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTab("open")}
                    className={cx(
                      "rounded-full border px-4 py-2 text-[12px] font-semibold transition",
                      tab === "open" ? "border-[rgba(255,59,122,0.35)] bg-[rgba(255,59,122,0.10)]" : "border-black/10 bg-white/70 hover:bg-white"
                    )}
                    style={{ color: tab === "open" ? "var(--pink)" : "var(--muted)" }}
                  >
                    OPEN
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("scheduled")}
                    className={cx(
                      "rounded-full border px-4 py-2 text-[12px] font-semibold transition",
                      tab === "scheduled" ? "border-[rgba(255,59,122,0.35)] bg-[rgba(255,59,122,0.10)]" : "border-black/10 bg-white/70 hover:bg-white"
                    )}
                    style={{ color: tab === "scheduled" ? "var(--pink)" : "var(--muted)" }}
                  >
                    SCHEDULED
                  </button>
                </div>
              </div>

              <p className="mt-5 text-[11px] font-semibold tracking-[0.18em]" style={{ color: "var(--pink)" }}>
                REQUESTS
              </p>
              <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-[#0f0f12]">
                候補日から日程確定
              </h1>
              <p className="mt-2 text-xs md:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                ユーザーが送った候補日を確認して、面接/体入をスケジュール化します。
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* list */}
              <NomiCard label="LIST" title="リクエスト一覧" className="md:col-span-1">
                {rows.length === 0 ? (
                  <p className="text-[12px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                    いまは {tab === "open" ? "OPEN" : "SCHEDULED"} がありません
                  </p>
                ) : (
                  <div className="space-y-2">
                    {rows.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedId(r.id)}
                        className={cx(
                          "w-full text-left rounded-2xl border px-4 py-3 transition",
                          selectedId === r.id
                            ? "border-[rgba(255,59,122,0.35)] bg-[rgba(255,59,122,0.10)]"
                            : "border-black/10 bg-white/70 hover:bg-white"
                        )}
                      >
                        <p className="text-[12px] font-semibold text-[#0f0f12]">
                          {r.type === "interview" ? "面接" : r.type === "trial" ? "体入" : "その他"} /{" "}
                          <span className="opacity-80">{r.userId.slice(0, 6)}…</span>
                        </p>
                        <p className="mt-1 text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                          候補 {r.candidates.length}件
                          {r.createdAt ? ` ・${r.createdAt.toLocaleDateString("ja-JP")}` : ""}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </NomiCard>

              {/* detail */}
              <NomiCard label="DETAIL" title="内容" className="md:col-span-2">
                {!selected ? (
                  <p className="text-[12px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                    左の一覧から選択してね
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3">
                      <p className="text-[12px] font-semibold text-[#0f0f12]">
                        ユーザー：{userInfo?.nickname || "（未設定）"}{" "}
                        <span className="text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                          / {selected.userId}
                        </span>
                      </p>
                      <p className="mt-1 text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                        希望エリア：{userInfo?.area || "—"} {userInfo?.phone ? ` / TEL: ${userInfo.phone}` : ""}
                      </p>
                      {selected.memo ? (
                        <p className="mt-2 text-[12px]" style={{ color: "var(--muted)" }}>
                          {selected.memo}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <p className="text-[12px] font-semibold text-[#0f0f12]">候補日</p>
                      <div className="mt-2 space-y-2">
                        {selected.candidates.map((c, idx) => (
                          <div key={idx} className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3">
                            <p className="text-[12px] font-semibold text-[#0f0f12]">
                              {idx + 1}. {fmtDateTime(c.startAt)}
                              {c.endAt ? ` 〜 ${fmtDateTime(c.endAt)}` : ""}
                            </p>
                            {c.note ? (
                              <p className="mt-1 text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                                {c.note}
                              </p>
                            ) : null}

                            {tab === "open" ? (
                              <div className="mt-3">
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => confirmCandidate(idx)}
                                  className={cx(
                                    "w-full rounded-full border px-4 py-2 text-[12px] font-semibold transition",
                                    "border-[rgba(255,59,122,0.35)] bg-[rgba(255,59,122,0.10)] hover:bg-[rgba(255,59,122,0.14)]",
                                    saving && "opacity-60 pointer-events-none"
                                  )}
                                  style={{ color: "var(--pink)" }}
                                >
                                  この候補で確定する
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* create settings */}
                    {tab === "open" ? (
                      <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-4">
                        <p className="text-[12px] font-semibold text-[#0f0f12]">確定時の設定（任意）</p>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                          <label className="block">
                            <span className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                              タイトル
                            </span>
                            <input
                              value={title}
                              onChange={(e) => setTitle(e.target.value)}
                              placeholder="例）渋谷◯◯ 店 面接"
                              className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-[12px] outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                              場所
                            </span>
                            <input
                              value={location}
                              onChange={(e) => setLocation(e.target.value)}
                              placeholder="例）渋谷駅 / 店名"
                              className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-[12px] outline-none"
                            />
                          </label>
                        </div>

                        <label className="block mt-2">
                          <span className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                            メモ
                          </span>
                          <textarea
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            rows={3}
                            placeholder="服装/集合/持ち物など（リクエストのメモを上書きできます）"
                            className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-[12px] outline-none"
                          />
                        </label>

                        <div className="mt-3">
  <button
    type="button"
    disabled={saving}
    onClick={closeRequest}
    className={cx(
      "w-full rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[12px] font-semibold hover:bg-white transition",
      saving && "opacity-60 pointer-events-none"
    )}
    style={{ color: "var(--muted)" }}
  >
    クローズ
  </button>
</div>

                      </div>
                    ) : (
                      <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-4">
                        <p className="text-[12px] font-semibold text-[#0f0f12]">確定情報</p>
                        <p className="mt-2 text-[12px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                          chosenIndex：{selected.chosenIndex ?? "—"}
                          <br />
                          scheduledEventId：{selected.scheduledEventId ?? "—"}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </NomiCard>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
