// app/schedule/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getDbClient } from "@/lib/firebase";
import NavieBg from "@/components/NavieBg";
import NavieButton from "@/components/NavieButton";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  addDoc,
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
      <p className="text-[11px] font-semibold tracking-[0.14em]" style={{ color: "var(--pink)" }}>
        {label}
      </p>
      <h2 className="mt-2 text-[15px] font-semibold text-[#0f0f12]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// --------------------
// types
// --------------------
type ScheduleType = "interview" | "trial" | "work" | "other";
type ScheduleStatus = "planned" | "confirmed" | "done" | "canceled";

type ScheduleDoc = {
  id: string;
  userId: string;
  type: ScheduleType;
  title: string;
  startAt: Date;
  endAt: Date | null;
  location: string;
  memo: string;
  status: ScheduleStatus;
  createdBy: "user" | "admin";
  adminId?: string | null;
  requestId?: string | null;
  isDeleted?: boolean;
};

type RequestType = "interview" | "trial" | "other";
type RequestStatus = "open" | "scheduled" | "closed";

type RequestCandidate = {
  startAt: Date;
  endAt: Date | null;
  note: string;
};

type RequestDoc = {
  id: string;
  userId: string;
  type: RequestType;
  candidates: RequestCandidate[];
  memo: string;
  status: RequestStatus;
  createdAt?: Date | null;
};

type CandInput = {
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endDate: string; // YYYY-MM-DD
  endTime: string; // HH:mm
  note: string;
};

type DatePreset = { label: string; value: string };
type TimePresetGroup = { label: string; times: Array<{ label: string; value: string }> };

// --------------------
// helpers
// --------------------
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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateInputValue(dt: Date) {
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function toTimeInputValue(dt: Date) {
  return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

function buildLocalDate(dateStr: string, timeStr: string) {
  return new Date(`${dateStr}T${timeStr}:00`);
}

function addMinutes(date: Date, mins: number) {
  return new Date(date.getTime() + mins * 60 * 1000);
}

// date utilities (local)
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
// 0=Sun ... 6=Sat
function nextDow(base: Date, targetDow: number, includeToday = true) {
  const b = startOfDay(base);
  const cur = b.getDay();
  let diff = (targetDow - cur + 7) % 7;
  if (!includeToday && diff === 0) diff = 7;
  return addDays(b, diff);
}
function formatJPShort(d: Date) {
  return d.toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit", weekday: "short" });
}

// --------------------
// labels
// --------------------
const TYPE_LABEL: Record<ScheduleType, string> = {
  interview: "面接",
  trial: "体験入店",
  work: "出勤",
  other: "その他",
};

const STATUS_LABEL: Record<ScheduleStatus, string> = {
  planned: "予定",
  confirmed: "確定",
  done: "完了",
  canceled: "キャンセル",
};

export default function SchedulePage() {
  const router = useRouter();
  const db = useMemo(() => getDbClient(), []);
  const { user, userData, loading } = useAuth();

  // ✅ 小ネタ：now を固定しない（1分ごとに更新）
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const now = useMemo(() => new Date(nowTick), [nowTick]);

  // --------------------
  // ✅ presets（hooksは早期returnより前に置く）
  // --------------------
  const base = useMemo(() => startOfDay(new Date()), []);

  type DatePresetRaw = { label: string; value: string; group: string; rank: number };

  const datePresetsRaw: DatePresetRaw[] = useMemo(() => {
    const today = base;
    const days = (n: number) => addDays(base, n);

    const thisFri = nextDow(base, 5, true);
    const thisSat = nextDow(base, 6, true);
    const thisSun = nextDow(base, 0, true);

    const nextFri = addDays(thisFri, 7);
    const nextSat = addDays(thisSat, 7);
    const nextSun = addDays(thisSun, 7);

    const nextMon = nextDow(base, 1, false);
    const nextTue = nextDow(base, 2, false);
    const nextWed = nextDow(base, 3, false);

    const r: DatePresetRaw[] = [];

    r.push({ label: `今日（${formatJPShort(today)}）`, value: toDateInputValue(today), group: "近い日", rank: 10 });
    r.push({ label: `明日（${formatJPShort(days(1))}）`, value: toDateInputValue(days(1)), group: "近い日", rank: 9 });
    r.push({ label: `明後日（${formatJPShort(days(2))}）`, value: toDateInputValue(days(2)), group: "近い日", rank: 8 });
    r.push({ label: `3日後（${formatJPShort(days(3))}）`, value: toDateInputValue(days(3)), group: "近い日", rank: 7 });
    r.push({ label: `4日後（${formatJPShort(days(4))}）`, value: toDateInputValue(days(4)), group: "近い日", rank: 6 });
    r.push({ label: `5日後（${formatJPShort(days(5))}）`, value: toDateInputValue(days(5)), group: "近い日", rank: 5 });
    r.push({ label: `1週間後（${formatJPShort(days(7))}）`, value: toDateInputValue(days(7)), group: "近い日", rank: 4 });

    r.push({ label: `今週 金（${formatJPShort(thisFri)}）`, value: toDateInputValue(thisFri), group: "今週末", rank: 3 });
    r.push({ label: `今週 土（${formatJPShort(thisSat)}）`, value: toDateInputValue(thisSat), group: "今週末", rank: 2 });
    r.push({ label: `今週 日（${formatJPShort(thisSun)}）`, value: toDateInputValue(thisSun), group: "今週末", rank: 1 });

    r.push({ label: `来週 金（${formatJPShort(nextFri)}）`, value: toDateInputValue(nextFri), group: "来週末", rank: 0 });
    r.push({ label: `来週 土（${formatJPShort(nextSat)}）`, value: toDateInputValue(nextSat), group: "来週末", rank: 0 });
    r.push({ label: `来週 日（${formatJPShort(nextSun)}）`, value: toDateInputValue(nextSun), group: "来週末", rank: 0 });

    r.push({ label: `次の月曜（${formatJPShort(nextMon)}）`, value: toDateInputValue(nextMon), group: "次の平日", rank: 0 });
    r.push({ label: `次の火曜（${formatJPShort(nextTue)}）`, value: toDateInputValue(nextTue), group: "次の平日", rank: 0 });
    r.push({ label: `次の水曜（${formatJPShort(nextWed)}）`, value: toDateInputValue(nextWed), group: "次の平日", rank: 0 });

    return r;
  }, [base]);

  const datePresetsUnique: DatePreset[] = useMemo(() => {
    const map = new Map<string, { value: string; baseLabel: string; tags: string[]; bestRank: number }>();
    const mainLabel = (label: string) => label.split("（")[0];

    for (const p of datePresetsRaw) {
      const exists = map.get(p.value);
      const tag = mainLabel(p.label);

      if (!exists) {
        map.set(p.value, { value: p.value, baseLabel: p.label, tags: [], bestRank: p.rank });
        continue;
      }

      if (p.rank > exists.bestRank) {
        const oldBase = mainLabel(exists.baseLabel);
        if (oldBase && !exists.tags.includes(oldBase) && oldBase !== tag) exists.tags.push(oldBase);
        exists.baseLabel = p.label;
        exists.bestRank = p.rank;
      } else {
        const baseMain = mainLabel(exists.baseLabel);
        if (tag && !exists.tags.includes(tag) && tag !== baseMain) exists.tags.push(tag);
      }
    }

    return Array.from(map.values())
      .map((x) => {
        const baseMain = mainLabel(x.baseLabel);
        const niceTags = x.tags.filter((t) => t && t !== baseMain).slice(0, 2);
        const label = niceTags.length > 0 ? `${x.baseLabel}（${niceTags.join(" / ")}）` : x.baseLabel;
        return { value: x.value, label, rank: x.bestRank };
      })
      .sort((a, b) => b.rank - a.rank)
      .map(({ value, label }) => ({ value, label }));
  }, [datePresetsRaw]);

  const timeGroups: TimePresetGroup[] = useMemo(() => {
    const hour = (h: number) => ({ label: `${pad2(h)}:00`, value: `${pad2(h)}:00` });
    const half = (h: number) => ({ label: `${pad2(h)}:30`, value: `${pad2(h)}:30` });

    return [
      { label: "昼〜夕方（毎時）", times: [10, 11, 12, 13, 14, 15, 16].map(hour) },
      { label: "夕方〜夜（毎時）", times: [17, 18, 19, 20, 21, 22, 23].map(hour) },
      { label: "夜（30分刻み）", times: [17, 18, 19, 20, 21, 22, 23].map(half) },
    ];
  }, []);

  const presetTimeValues = useMemo(() => timeGroups.flatMap((g) => g.times.map((t) => t.value)), [timeGroups]);

  // ---- role guard
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
      router.replace("/requests");
      return;
    }
    if (userData?.role === "pending") {
      router.replace("/pending");
      return;
    }
  }, [user, userData, loading, router]);

  const isLoadingAll = loading || !user || !userData;

  // ---- schedules (view + cancel optional)
  const [schedules, setSchedules] = useState<ScheduleDoc[]>([]);
  useEffect(() => {
    if (!db || !user) return;

    const qy = query(
      collection(db, "schedules"),
      where("userId", "==", user.uid),
      where("isDeleted", "in", [false, null]),
      orderBy("startAt", "asc")
    );

    const unsub = onSnapshot(qy, (snap) => {
      const rows: ScheduleDoc[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          userId: data.userId,
          type: data.type ?? "other",
          title: data.title ?? "",
          startAt: data.startAt?.toDate ? data.startAt.toDate() : new Date(),
          endAt: data.endAt?.toDate ? data.endAt.toDate() : null,
          location: data.location ?? "",
          memo: data.memo ?? "",
          status: data.status ?? "planned",
          createdBy: data.createdBy ?? "admin",
          adminId: data.adminId ?? null,
          requestId: data.requestId ?? null,
          isDeleted: data.isDeleted ?? false,
        };
      });
      setSchedules(rows);
    });

    return () => unsub();
  }, [db, user]);

  const upcoming = useMemo(
    () => schedules.filter((s) => s.startAt.getTime() >= now.getTime() && s.status !== "canceled"),
    [schedules, now]
  );

  const past = useMemo(
    () =>
      schedules.filter(
        (s) => s.startAt.getTime() < now.getTime() || s.status === "done" || s.status === "canceled"
      ),
    [schedules, now]
  );

  const pastSorted = useMemo(() => {
    return [...past].sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
  }, [past]);

  // ---- 表示件数（これから / 過去）
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllPast, setShowAllPast] = useState(false);
  const UPCOMING_LIMIT = 3;
  const PAST_LIMIT = 3;

  const visibleUpcoming = useMemo(() => {
    if (showAllUpcoming) return upcoming;
    return upcoming.slice(0, UPCOMING_LIMIT);
  }, [upcoming, showAllUpcoming]);

  const visiblePast = useMemo(() => {
    if (showAllPast) return pastSorted;
    return pastSorted.slice(0, PAST_LIMIT);
  }, [pastSorted, showAllPast]);

  const upcomingHiddenCount = Math.max(0, upcoming.length - visibleUpcoming.length);
  // ✅ 小ネタ：pastは並び替えてるので sorted側で計算したほうが自然
  const pastHiddenCount = Math.max(0, pastSorted.length - visiblePast.length);

  // キャンセル（不要ならボタンごと消してOK）
  const cancelSchedule = async (id: string) => {
    if (!db) return;
    if (!confirm("この予定をキャンセルにする？")) return;
    await updateDoc(doc(db, "schedules", id), {
      status: "canceled",
      updatedAt: serverTimestamp(),
    });
  };

  // ---- requests (user -> admin)
  const [requests, setRequests] = useState<RequestDoc[]>([]);
  useEffect(() => {
    if (!db || !user) return;

    const qy = query(collection(db, "requests"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(qy, (snap) => {
      const rows: RequestDoc[] = snap.docs.map((d) => {
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
          candidates,
          memo: data.memo ?? "",
          status: data.status ?? "open",
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
        };
      });
      setRequests(rows);
    });

    return () => unsub();
  }, [db, user]);

  // ---- request form
  const [reqType, setReqType] = useState<RequestType>("interview");
  const [reqMemo, setReqMemo] = useState("");
  const [cand, setCand] = useState<CandInput[]>(() => {
    const tmr = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return [
      { startDate: toDateInputValue(tmr), startTime: "18:00", endDate: "", endTime: "", note: "" },
      { startDate: "", startTime: "", endDate: "", endTime: "", note: "" },
      { startDate: "", startTime: "", endDate: "", endTime: "", note: "" },
    ];
  });
  const [reqSaving, setReqSaving] = useState(false);

  // 候補2,3は折りたたみ（初期は候補1だけ表示）
  const [openCand, setOpenCand] = useState<[boolean, boolean, boolean]>([true, false, false]);
  const toggleCand = (i: 0 | 1 | 2) =>
    setOpenCand((prev) => {
      const next = [...prev] as [boolean, boolean, boolean];
      next[i] = !next[i];
      return next;
    });

  // ---- YOUR REQUESTS の表示を絞る
  const [showAllRequests, setShowAllRequests] = useState(false);
  const REQUESTS_LIMIT = 3;

  const visibleRequests = useMemo(() => {
    if (showAllRequests) return requests;
    return requests.slice(0, REQUESTS_LIMIT);
  }, [requests, showAllRequests]);

  const hiddenCount = Math.max(0, requests.length - visibleRequests.length);

  const handleSendRequest = async () => {
    if (!db || !user) return;

    const cleaned = cand
      .filter((c) => !!c.startDate && !!c.startTime)
      .map((c) => {
        const start = buildLocalDate(c.startDate, c.startTime);
        const end = c.endDate && c.endTime ? buildLocalDate(c.endDate, c.endTime) : null;
        return {
          startAt: Timestamp.fromDate(start),
          endAt: end ? Timestamp.fromDate(end) : null,
          note: (c.note ?? "").trim(),
        };
      });

    if (cleaned.length === 0) return alert("候補日を1つ以上入れてね");

    setReqSaving(true);
    try {
      await addDoc(collection(db, "requests"), {
        userId: user.uid,
        type: reqType,
        candidates: cleaned,
        memo: reqMemo.trim(),
        status: "open",
        chosenIndex: null,
        scheduledEventId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setReqMemo("");
      const tmr = new Date(Date.now() + 24 * 60 * 60 * 1000);
      setCand([
        { startDate: toDateInputValue(tmr), startTime: "18:00", endDate: "", endTime: "", note: "" },
        { startDate: "", startTime: "", endDate: "", endTime: "", note: "" },
        { startDate: "", startTime: "", endDate: "", endTime: "", note: "" },
      ]);

      // 送信後：候補1だけ開く＆候補2,3は閉じる
      setOpenCand([true, false, false]);

      alert("候補日を送ったよ！");
      setShowAllRequests(false);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "送信に失敗した…");
    } finally {
      setReqSaving(false);
    }
  };

  // ✅ 早期returnはここ（hooksの後）に置く！
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
              background: "radial-gradient(900px 420px at 20% 10%, rgba(255,255,255,0.55), transparent 60%)",
            }}
          />

          <div className="relative">
            <header className="mb-6">
              <div className="flex items-center justify-between gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2 text-[12px] font-semibold"
                  style={{ color: "var(--muted)" }}
                >
                  <span className="h-7 w-7 rounded-full border border-black/10 bg-white/70 backdrop-blur-[10px] flex items-center justify-center">
                    <span className="text-[12px]" style={{ color: "var(--pink)" }}>
                      ←
                    </span>
                  </span>
                  ダッシュボードへ
                </Link>
              </div>

              <p className="mt-5 text-[11px] font-semibold tracking-[0.18em]" style={{ color: "var(--pink)" }}>
                SCHEDULE
              </p>
              <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-[#0f0f12]">スケジュール</h1>
              <p className="mt-2 text-xs md:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                面接・体入などの確定予定を確認。候補日を送ると運営が日程確定してくれます。
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NomiCard label="UPCOMING" title="これからの予定">
                <div className="flex items-center justify-between gap-3 -mt-1 mb-3">
                  <p className="text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                    {upcoming.length > 0 ? `表示：直近 ${Math.min(UPCOMING_LIMIT, upcoming.length)} 件` : ""}
                  </p>

                  {upcoming.length > UPCOMING_LIMIT ? (
                    <button
                      type="button"
                      onClick={() => setShowAllUpcoming((v) => !v)}
                      className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[12px] font-semibold hover:bg-white transition"
                      style={{ color: "var(--muted)" }}
                    >
                      {showAllUpcoming ? "折りたたむ" : "もっと見る"}
                    </button>
                  ) : null}
                </div>

                {upcoming.length === 0 ? (
                  <p className="text-[12px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                    まだ確定予定がありません。下で候補日を送ってね。
                  </p>
                ) : (
                  <>
                    <div className="space-y-3">
                      {visibleUpcoming.map((s) => (
                        <div key={s.id} className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[12px] font-semibold text-[#0f0f12]">
                                {TYPE_LABEL[s.type]}：{s.title}
                              </p>
                              <p className="mt-1 text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                                {fmtDateTime(s.startAt)}
                                {s.endAt ? ` 〜 ${fmtDateTime(s.endAt)}` : ""}
                              </p>
                              {s.location ? (
                                <p className="mt-1 text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                                  📍 {s.location}
                                </p>
                              ) : null}
                              {s.memo ? (
                                <p className="mt-2 text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>
                                  {s.memo}
                                </p>
                              ) : null}
                            </div>

                            <div className="shrink-0 text-right">
                              <span
                                className={cx(
                                  "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold border",
                                  s.status === "confirmed"
                                    ? "border-[rgba(255,59,122,0.35)] bg-[rgba(255,59,122,0.10)]"
                                    : "border-black/10 bg-white/70"
                                )}
                                style={{ color: s.status === "confirmed" ? "var(--pink)" : "rgba(95,96,107,0.85)" }}
                              >
                                {STATUS_LABEL[s.status]}
                              </span>

                              {s.status !== "canceled" && s.status !== "done" ? (
                                <button
                                  type="button"
                                  onClick={() => cancelSchedule(s.id)}
                                  className="mt-2 block w-full rounded-full border border-black/10 bg-white/70 px-3 py-2 text-[11px] font-semibold hover:bg-white transition"
                                  style={{ color: "var(--muted)" }}
                                >
                                  キャンセル
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {upcoming.length > UPCOMING_LIMIT ? (
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                          {showAllUpcoming ? "すべて表示中" : `ほか ${upcomingHiddenCount} 件は非表示`}
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowAllUpcoming((v) => !v)}
                          className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[12px] font-semibold hover:bg-white transition"
                          style={{ color: "var(--muted)" }}
                        >
                          {showAllUpcoming ? "折りたたむ" : "もっと見る"}
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </NomiCard>

              <NomiCard label="HISTORY" title="過去の予定">
                <div className="flex items-center justify-between gap-3 -mt-1 mb-3">
                  <p className="text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                    {pastSorted.length > 0 ? `表示：最新 ${Math.min(PAST_LIMIT, pastSorted.length)} 件` : ""}
                  </p>

                  {pastSorted.length > PAST_LIMIT ? (
                    <button
                      type="button"
                      onClick={() => setShowAllPast((v) => !v)}
                      className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[12px] font-semibold hover:bg-white transition"
                      style={{ color: "var(--muted)" }}
                    >
                      {showAllPast ? "折りたたむ" : "もっと見る"}
                    </button>
                  ) : null}
                </div>

                {pastSorted.length === 0 ? (
                  <p className="text-[12px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                    まだありません
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {visiblePast.map((s) => (
                        <div key={s.id} className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3">
                          <p className="text-[12px] font-semibold text-[#0f0f12]">
                            {TYPE_LABEL[s.type]}：{s.title}
                          </p>
                          <p className="mt-1 text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                            {fmtDateTime(s.startAt)}
                          </p>
                        </div>
                      ))}
                    </div>

                    {pastSorted.length > PAST_LIMIT ? (
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                          {showAllPast ? "すべて表示中" : `ほか ${pastHiddenCount} 件は非表示`}
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowAllPast((v) => !v)}
                          className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[12px] font-semibold hover:bg-white transition"
                          style={{ color: "var(--muted)" }}
                        >
                          {showAllPast ? "折りたたむ" : "もっと見る"}
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </NomiCard>

              <NomiCard label="REQUEST" title="候補日を送る（運営が日程確定）" className="md:col-span-2">
                <div className="rounded-3xl border border-[rgba(255,59,122,0.18)] bg-white/55 backdrop-blur-[10px] p-4 md:p-5">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-semibold text-[#0f0f12]">送る内容</p>
                      <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "rgba(95,96,107,0.85)" }}>
                        候補日は最大3つ。<span style={{ color: "var(--pink)" }}>開始だけ必須</span>
                        でOK。運営が決まり次第、スケジュールに反映します。
                      </p>
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-2">
                      <span className="text-[10px] font-semibold tracking-[0.18em]" style={{ color: "var(--pink)" }}>
                        TIPS
                      </span>
                      <span className="text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                        NG時間・最寄駅・服装など書くと確定が早い
                      </span>
                    </div>
                  </div>

                  {/* purpose chips */}
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold tracking-[0.14em]" style={{ color: "var(--pink)" }}>
                      PURPOSE
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(
                        [
                          { key: "interview", label: "面接" },
                          { key: "trial", label: "体験入店" },
                          { key: "other", label: "その他" },
                        ] as const
                      ).map((t) => {
                        const active = reqType === t.key;
                        return (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => setReqType(t.key)}
                            className={cx(
                              "rounded-full px-4 py-2 text-[12px] font-semibold transition border",
                              active
                                ? "border-[rgba(255,59,122,0.35)] bg-[rgba(255,59,122,0.10)]"
                                : "border-black/10 bg-white/70 hover:bg-white"
                            )}
                            style={{ color: active ? "var(--pink)" : "var(--muted)" }}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* candidates */}
                  <div className="mt-5">
                    <p className="text-[11px] font-semibold tracking-[0.14em]" style={{ color: "var(--pink)" }}>
                      CANDIDATES
                    </p>

                    <div className="mt-3 space-y-3">
                      {cand.map((c, idx) => {
                        const ready = !!c.startDate && !!c.startTime;

                        const setField = (patch: Partial<CandInput>) => {
                          const next = [...cand];
                          next[idx] = { ...next[idx], ...patch };
                          setCand(next);
                        };

                        const applyDuration = (mins: number | null) => {
                          if (!c.startDate || !c.startTime) {
                            alert("先に開始日と開始時間を入れてね");
                            return;
                          }
                          if (mins == null) {
                            setField({ endDate: "", endTime: "" });
                            return;
                          }
                          const start = buildLocalDate(c.startDate, c.startTime);
                          const end = addMinutes(start, mins);
                          setField({ endDate: toDateInputValue(end), endTime: toTimeInputValue(end) });
                        };

                        const datePresetValue = datePresetsUnique.some((p) => p.value === c.startDate) ? c.startDate : "";
                        const timePresetValue = presetTimeValues.includes(c.startTime) ? c.startTime : "";

                        const isOpen = openCand[idx] ?? true;
                        const toggleLabel = isOpen ? "折りたたむ" : "入力する";
                        const hasAnyValue =
                          !!c.startDate || !!c.startTime || !!c.endDate || !!c.endTime || !!(c.note ?? "").trim();

                        return (
                          <div key={idx} className="rounded-3xl border border-black/10 bg-white/70 overflow-hidden">
                            {/* header */}
                            <div className="px-4 py-4 md:px-5 md:py-5 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white/70 text-[12px] font-semibold"
                                  style={{ color: "var(--pink)" }}
                                >
                                  {idx + 1}
                                </span>
                                <p className="text-[12px] font-semibold text-[#0f0f12]">候補 {idx + 1}</p>

                                {idx > 0 ? (
                                  <span
                                    className={cx(
                                      "ml-1 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold border",
                                      hasAnyValue
                                        ? "border-[rgba(255,59,122,0.22)] bg-[rgba(255,59,122,0.08)]"
                                        : "border-black/10 bg-white/70"
                                    )}
                                    style={{ color: hasAnyValue ? "var(--pink)" : "rgba(95,96,107,0.85)" }}
                                  >
                                    {hasAnyValue ? "入力あり" : "未入力"}
                                  </span>
                                ) : null}
                              </div>

                              <div className="flex items-center gap-2">
                                <span
                                  className={cx(
                                    "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold border",
                                    ready
                                      ? "border-[rgba(255,59,122,0.35)] bg-[rgba(255,59,122,0.10)]"
                                      : "border-black/10 bg-white/70"
                                  )}
                                  style={{ color: ready ? "var(--pink)" : "rgba(95,96,107,0.85)" }}
                                >
                                  {ready ? "READY" : "EMPTY"}
                                </span>

                                {/* 候補2,3だけ折りたたみ */}
                                {idx > 0 ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleCand(idx as 1 | 2)}
                                    className="rounded-full border border-black/10 bg-white/70 px-3 py-2 text-[12px] font-semibold hover:bg-white transition"
                                    style={{ color: "var(--muted)" }}
                                  >
                                    {toggleLabel}
                                  </button>
                                ) : null}
                              </div>
                            </div>

                            {/* body */}
                            {idx === 0 || isOpen ? (
                              <div className="px-4 pb-4 md:px-5 md:pb-5 -mt-2">
                                {/* presets (select) */}
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <label className="block">
                                    <span className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                                      日付プリセット
                                    </span>
                                    <select
                                      value={datePresetValue}
                                      onChange={(e) => setField({ startDate: e.target.value })}
                                      className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-[12px] outline-none hover:bg-white transition"
                                      style={{ color: "var(--muted)" }}
                                    >
                                      <option value="">手入力（カスタム）</option>
                                      {datePresetsUnique.map((p, i) => (
                                        <option key={`${p.value}-${i}`} value={p.value}>
                                          {p.label}
                                        </option>
                                      ))}
                                    </select>
                                  </label>

                                  <label className="block">
                                    <span className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                                      時間プリセット
                                    </span>
                                    <select
                                      value={timePresetValue}
                                      onChange={(e) => setField({ startTime: e.target.value })}
                                      className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-[12px] outline-none hover:bg-white transition"
                                      style={{ color: "var(--muted)" }}
                                    >
                                      <option value="">手入力（カスタム）</option>
                                      {timeGroups.map((g) => (
                                        <optgroup key={g.label} label={g.label}>
                                          {g.times.map((t) => (
                                            <option key={`${g.label}-${t.value}`} value={t.value}>
                                              {t.label}
                                            </option>
                                          ))}
                                        </optgroup>
                                      ))}
                                    </select>
                                  </label>
                                </div>

                                {/* start inputs */}
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <label className="block">
                                    <span className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                                      開始日（必須）
                                    </span>
                                    <input
                                      type="date"
                                      value={c.startDate}
                                      onChange={(e) => setField({ startDate: e.target.value })}
                                      className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-[12px] outline-none focus:border-[rgba(255,59,122,0.35)] focus:ring-2 focus:ring-[rgba(255,59,122,0.10)]"
                                    />
                                  </label>

                                  <label className="block">
                                    <span className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                                      開始時間（必須）
                                    </span>
                                    <input
                                      type="time"
                                      value={c.startTime}
                                      onChange={(e) => setField({ startTime: e.target.value })}
                                      className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-[12px] outline-none focus:border-[rgba(255,59,122,0.35)] focus:ring-2 focus:ring-[rgba(255,59,122,0.10)]"
                                    />
                                  </label>
                                </div>

                                {/* end quick duration + manual */}
                                <div className="mt-3">
                                  <p className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                                    終了（任意）
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {[
                                      { label: "なし", mins: null as number | null },
                                      { label: "60分", mins: 60 },
                                      { label: "90分", mins: 90 },
                                      { label: "120分", mins: 120 },
                                    ].map((it) => (
                                      <button
                                        key={it.label}
                                        type="button"
                                        onClick={() => applyDuration(it.mins)}
                                        className="rounded-full border border-black/10 bg-white/70 px-3 py-2 text-[12px] font-semibold hover:bg-white transition"
                                        style={{ color: "var(--muted)" }}
                                      >
                                        {it.label}
                                      </button>
                                    ))}
                                  </div>

                                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                    <input
                                      type="date"
                                      value={c.endDate}
                                      onChange={(e) => setField({ endDate: e.target.value })}
                                      className="w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-[12px] outline-none"
                                    />
                                    <input
                                      type="time"
                                      value={c.endTime}
                                      onChange={(e) => setField({ endTime: e.target.value })}
                                      className="w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-[12px] outline-none"
                                    />
                                  </div>
                                </div>

                                {/* note */}
                                <label className="block mt-3">
                                  <span className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                                    補足（任意）
                                  </span>
                                  <input
                                    value={c.note}
                                    onChange={(e) => setField({ note: e.target.value })}
                                    placeholder="例）18時以降なら可 / 渋谷駅からが助かる など"
                                    className="mt-1 w-full rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-[12px] outline-none focus:border-[rgba(255,59,122,0.35)] focus:ring-2 focus:ring-[rgba(255,59,122,0.10)]"
                                  />
                                </label>

                                <p className="mt-2 text-[10px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                                  ※ 候補は「開始日＋開始時間」が入っているものだけ送信されます
                                </p>
                              </div>
                            ) : (
                              <div className="px-4 pb-4 md:px-5 md:pb-5">
                                <p className="text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                                  候補 {idx + 1} は折りたたみ中。必要になったら「入力する」を押してね。
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* memo */}
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold tracking-[0.14em]" style={{ color: "var(--pink)" }}>
                      NOTE
                    </p>
                    <textarea
                      value={reqMemo}
                      onChange={(e) => setReqMemo(e.target.value)}
                      rows={3}
                      placeholder="NG時間 / 最寄駅 / 服装 / 連絡取りやすい時間帯 など"
                      className="mt-2 w-full rounded-3xl border border-black/10 bg-white/70 px-4 py-3 text-[12px] outline-none focus:border-[rgba(255,59,122,0.35)] focus:ring-2 focus:ring-[rgba(255,59,122,0.10)]"
                    />
                  </div>

                  {/* action */}
                  <div className="mt-4">
                    <NavieButton
                      href="#"
                      className={cx("w-full justify-center", reqSaving && "opacity-60 pointer-events-none")}
                      onClick={(e: any) => {
                        e?.preventDefault?.();
                        handleSendRequest();
                      }}
                    >
                      {reqSaving ? "送信中…" : "候補日を送る"}
                    </NavieButton>

                    <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      <p className="text-[10px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                        送信後、運営が確認して確定します（確定したら上のスケジュールに表示）
                      </p>
                      <span
                        className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-3 py-1 text-[10px] font-semibold"
                        style={{ color: "var(--muted)" }}
                      >
                        MAX 3 CANDIDATES
                      </span>
                    </div>
                  </div>
                </div>

                {/* requests list */}
                <div className="mt-5">
                  <p className="text-[11px] font-semibold tracking-[0.14em]" style={{ color: "var(--pink)" }}>
                    YOUR REQUESTS
                  </p>

                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                      {requests.length > 0 ? `表示：最新 ${Math.min(REQUESTS_LIMIT, requests.length)} 件` : ""}
                    </p>

                    {requests.length > REQUESTS_LIMIT ? (
                      <button
                        type="button"
                        onClick={() => setShowAllRequests((v) => !v)}
                        className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[12px] font-semibold hover:bg-white transition"
                        style={{ color: "var(--muted)" }}
                      >
                        {showAllRequests ? "折りたたむ" : "もっと見る"}
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-3">
                    {requests.length === 0 ? (
                      <p className="text-[12px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                        まだ候補日を送っていません
                      </p>
                    ) : (
                      <>
                        {visibleRequests.map((r) => (
                          <div key={r.id} className="rounded-3xl border border-black/10 bg-white/70 px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[12px] font-semibold text-[#0f0f12]">
                                  {r.type === "interview" ? "面接" : r.type === "trial" ? "体入" : "その他"} の候補日
                                </p>
                                <p className="mt-1 text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                                  状態：
                                  {r.status === "open" ? "受付中" : r.status === "scheduled" ? "日程確定" : "クローズ"}
                                </p>

                                <div className="mt-2 space-y-1">
                                  {r.candidates.map((c, i) => (
                                    <p key={i} className="text-[12px]" style={{ color: "var(--muted)" }}>
                                      ・{fmtDateTime(c.startAt)}
                                      {c.endAt ? ` 〜 ${fmtDateTime(c.endAt)}` : ""}
                                      {c.note ? `（${c.note}）` : ""}
                                    </p>
                                  ))}
                                </div>

                                {r.memo ? (
                                  <p className="mt-2 text-[12px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                                    {r.memo}
                                  </p>
                                ) : null}
                              </div>

                              <span
                                className={cx(
                                  "inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold border",
                                  r.status === "open"
                                    ? "border-[rgba(255,59,122,0.35)] bg-[rgba(255,59,122,0.10)]"
                                    : "border-black/10 bg-white/70"
                                )}
                                style={{ color: r.status === "open" ? "var(--pink)" : "rgba(95,96,107,0.85)" }}
                              >
                                {r.status === "open" ? "OPEN" : r.status === "scheduled" ? "SCHEDULED" : "CLOSED"}
                              </span>
                            </div>
                          </div>
                        ))}

                        {requests.length > REQUESTS_LIMIT ? (
                          <div className="mt-1 flex items-center justify-between gap-3">
                            <p className="text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                              {showAllRequests ? "すべて表示中" : `ほか ${hiddenCount} 件は非表示`}
                            </p>
                            <button
                              type="button"
                              onClick={() => setShowAllRequests((v) => !v)}
                              className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[12px] font-semibold hover:bg-white transition"
                              style={{ color: "var(--muted)" }}
                            >
                              {showAllRequests ? "折りたたむ" : "もっと見る"}
                            </button>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              </NomiCard>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
