// app/schedule/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getDbClient } from "@/lib/firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import NavieBg from "@/components/NavieBg";
import NavieButton from "@/components/NavieButton";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function TimeSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="relative">
      <div
        className={[
          "rounded-2xl p-[1px]",
          "bg-[linear-gradient(135deg,rgba(255,59,122,0.22),rgba(255,59,122,0.10),rgba(0,0,0,0.06))]",
        ].join(" ")}
      >
        <div className="rounded-2xl bg-white/80 backdrop-blur-[10px] shadow-[0_10px_30px_rgba(18,18,24,0.08)]">
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={[
              "h-11 w-full rounded-2xl",
              "px-4 pr-10 text-[14px] font-semibold",
              "bg-transparent",
              "border-0 outline-none",
              "appearance-none",
              "text-[#0f0f12]",
              "focus:ring-2 focus:ring-[rgba(255,59,122,0.20)]",
            ].join(" ")}
          >
            {options.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M7 10l5 5 5-5"
                stroke="rgba(255,59,122,0.70)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function parseCandidateKey(s: string) {
  const [datePart, timePart] = s.split("T");
  return { datePart, timePart };
}
function formatCandidateJP(s: string) {
  const { datePart, timePart } = parseCandidateKey(s);
  const [Y, M, D] = datePart.split("-").map(Number);
  const d = new Date(Y, (M ?? 1) - 1, D ?? 1);
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${M}/${D}(${w}) ${timePart}`;
}
function groupCandidates(list: string[]) {
  const map = new Map<string, string[]>();
  for (const c of list) {
    const { datePart } = parseCandidateKey(c);
    const arr = map.get(datePart) ?? [];
    arr.push(c);
    map.set(datePart, arr);
  }
  const entries = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  return entries.map(([datePart, items]) => ({
    datePart,
    items: items.slice().sort((x, y) => x.localeCompare(y)),
  }));
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function ymd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function addMonths(d: Date, diff: number) {
  return new Date(d.getFullYear(), d.getMonth() + diff, 1);
}
function fmtMonth(d: Date) {
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}`;
}
function fmtDateJP(d: Date) {
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${w})`;
}
function buildCalendarCells(month: Date) {
  const first = startOfMonth(month);
  const firstDay = first.getDay();
  const start = new Date(first);
  start.setDate(first.getDate() - firstDay);

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
function fromMin(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

type RequestDoc = {
  userId: string;
  status: "draft" | "submitted" | "confirmed";
  candidates: string[];
  note?: string;
  confirmed?: {
    type: "interview" | "trial";
    start: string;
    end: string;
    place?: string;
  };
};

const TIMES_30MIN = Array.from({ length: 48 }, (_, i) => {
  const hh = Math.floor(i / 2);
  const mm = i % 2 === 0 ? "00" : "30";
  return `${pad2(hh)}:${mm}`;
});

const QUICK_RANGES: Array<{ label: string; start: string; end: string }> = [
  { label: "18:00–20:00", start: "18:00", end: "20:00" },
  { label: "20:00–22:00", start: "20:00", end: "22:00" },
  { label: "22:00–24:00", start: "22:00", end: "24:00" },
  { label: "0:00–2:00", start: "00:00", end: "02:00" },
  { label: "12:00–16:00", start: "12:00", end: "16:00" },
];

export default function SchedulePage() {
  const router = useRouter();
  const db = useMemo(() => getDbClient(), []);
  const { user, userData, loading } = useAuth();

  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedYmd, setSelectedYmd] = useState<string>(() => ymd(new Date()));

  const [candidates, setCandidates] = useState<string[]>([]);
  const [note, setNote] = useState("");

  const [statusText, setStatusText] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const [docStatus, setDocStatus] = useState<RequestDoc["status"]>("draft");
  const [confirmed, setConfirmed] = useState<RequestDoc["confirmed"] | null>(null);

  const [startHHMM, setStartHHMM] = useState<string>("18:00");
  const [endHHMM, setEndHHMM] = useState<string>("20:00");

  const calendarCells = useMemo(() => buildCalendarCells(month), [month]);

  const selectedDateObj = useMemo(() => {
    const [Y, M, D] = selectedYmd.split("-").map((v) => Number(v));
    return new Date(Y, (M ?? 1) - 1, D ?? 1);
  }, [selectedYmd]);

  const clearToastSoon = () => {
    setTimeout(() => setStatusText(""), 2500);
  };

  // ===== 正規化（ここが肝）=====
  const RE = /^\d{4}-\d{2}-\d{2}T\d{2}:(00|30)$/;

  const normalizeCandidate = (s: string): string | null => {
    // "2026-1-7T8:30:00Z" みたいなのも拾って "2026-01-07T08:30" に寄せる
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{2})/);
    if (!m) return null;
    const Y = m[1];
    const M = String(Number(m[2])).padStart(2, "0");
    const D = String(Number(m[3])).padStart(2, "0");
    const H = String(Number(m[4])).padStart(2, "0");
    const Min = m[5];
    const v = `${Y}-${M}-${D}T${H}:${Min}`;
    return RE.test(v) ? v : null;
  };

  const sanitizeCandidates = (arr: unknown): string[] => {
    const raw: unknown[] = Array.isArray(arr) ? arr : [];
    return Array.from(
      new Set(
        raw
          .filter((c): c is string => typeof c === "string")
          .map((c) => normalizeCandidate(c))
          .filter((v): v is string => !!v)
      )
    ).sort();
  };

  // ===== ロールガード =====
  useEffect(() => {
    if (loading) return;
    if (!user) return void router.replace("/login");
    if (userData?.role === "suspended") return void router.replace("/suspended");
    if (userData?.role === "admin") return void router.replace("/admin");
    if (userData?.role === "pending") return void router.replace("/pending");
  }, [user, userData, loading, router]);

  // ===== 読み込み =====
  useEffect(() => {
    if (!db || !user) return;
    (async () => {
      const ref = doc(db, "interviewRequests", user.uid);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;

      const data = snap.data() as Record<string, unknown>;

      const cleaned = sanitizeCandidates((data as any).candidates);
      setCandidates(cleaned);

      setNote(typeof data.note === "string" ? data.note : "");
      setDocStatus((typeof data.status === "string" ? data.status : "draft") as RequestDoc["status"]);
      setConfirmed((data as any).confirmed ?? null);
    })();
  }, [db, user]);

  // ===== 範囲追加 =====
  const makeKeysFromRange = (start: string, end: string) => {
    const sMin = toMin(start);
    const eMin = end === "24:00" ? 1440 : toMin(end);
    if (eMin <= sMin) return [];

    const out: string[] = [];
    for (let t = sMin; t < eMin; t += 30) {
      const hhmm = fromMin(t);
      out.push(`${selectedYmd}T${hhmm}`);
    }
    return out;
  };

  const applyRangeAdd = (start: string, end: string) => {
    const keys = makeKeysFromRange(start, end);

    if (keys.length === 0) {
      setStatusText("終了は開始より後にしてね");
      clearToastSoon();
      return;
    }

    setCandidates((prev) => {
      const set = new Set(prev);

      // 形式チェック（念のため）
      const normalized = keys
        .map((k) => normalizeCandidate(k))
        .filter((v): v is string => !!v);

      const toAdd = normalized.filter((k) => !set.has(k));

      if (toAdd.length === 0) {
        setStatusText(`すでに追加済み：${start}〜${end}`);
        clearToastSoon();
        return prev;
      }

      if (set.size + toAdd.length > 20) {
        setStatusText("候補は最大20件まで 🙏（範囲が大きすぎるかも）");
        clearToastSoon();
        return prev;
      }

      toAdd.forEach((k) => set.add(k));

      setStatusText(`追加：${start}〜${end}`);
      clearToastSoon();

      const next = Array.from(set).sort();
      return next;
    });
  };

  const removeCandidate = (key: string) => {
    setCandidates((prev) => prev.filter((x) => x !== key));
  };

  // ===== 保存 =====
  const save = async (nextStatus: "draft" | "submitted") => {
    if (!db || !user) return;
    setSaving(true);
    setStatusText("");

    try {
      const r = await user.getIdTokenResult(true);

      const sanitizedCandidates = Array.from(
        new Set(
          candidates
            .map((c) => normalizeCandidate(c))
            .filter((v): v is string => !!v)
        )
      ).sort();

      // デバッグ（今どの条件で落ちてるか見る）
      console.log("claims.email_verified:", r.claims.email_verified);
      console.log("user.emailVerified:", user.emailVerified);
      console.log("uid:", user.uid);
      console.log("role:", userData?.role);
      console.log("sanitizedCandidates.length:", sanitizedCandidates.length);
      console.log("sanitizedCandidates:", sanitizedCandidates);

      // フロントでも最終ガード（rulesと一致させる）
      const bad = sanitizedCandidates.filter((c) => !RE.test(c));
      if (bad.length) {
        setStatusText(`形式NGが混ざってる: ${bad.join(", ")}`);
        return;
      }
      if (sanitizedCandidates.length > 20) {
        setStatusText("候補は最大20件まで 🙏");
        return;
      }

      const payload: Partial<RequestDoc> = {
        userId: user.uid,
        status: nextStatus,
        candidates: sanitizedCandidates, // ← 必ずこれだけ送る
        note: note.trim(),
      };

      await setDoc(
        doc(db, "interviewRequests", user.uid),
        {
          ...payload,
          updatedAt: serverTimestamp(),
          ...(nextStatus === "submitted" ? { submittedAt: serverTimestamp() } : {}),
        },
        { merge: true }
      );

      setDocStatus(nextStatus);
      setStatusText(nextStatus === "submitted" ? "提出しました ✅（運営が確認します）" : "保存しました ✅");
    } catch (e: any) {
      console.error("save failed:", e);
      const code = e?.code ? `(${e.code}) ` : "";
      setStatusText(code + (e?.message ?? "保存に失敗しました"));
    } finally {
      setSaving(false);
      clearToastSoon();
    }
  };

  const isLoadingAll = loading || !user || !userData;

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

                <NavieButton href="/chat" className="px-4 py-2 text-[12px]">
                  相談する
                </NavieButton>
              </div>

              <p className="mt-5 text-[11px] font-semibold tracking-[0.18em]" style={{ color: "var(--pink)" }}>
                SCHEDULE
              </p>
              <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-[#0f0f12]">
                候補日時を選ぶ
              </h1>
              <p className="mt-2 text-xs md:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                :00 / :30 固定。<span className="font-semibold">開始・終了</span>で綺麗に選べます。
              </p>
            </header>

            {confirmed && (
              <section className="nomi-card p-6 md:p-7 mb-4">
                <p className="text-[11px] font-semibold tracking-[0.18em]" style={{ color: "var(--pink)" }}>
                  CONFIRMED
                </p>
                <h2 className="mt-2 text-[15px] font-semibold text-[#0f0f12]">確定しました ✅</h2>
                <p className="mt-2 text-[12px]" style={{ color: "var(--muted)" }}>
                  {confirmed.type === "interview" ? "面接" : "体験入店"}：{confirmed.start} 〜 {confirmed.end}
                  {confirmed.place ? `（${confirmed.place}）` : ""}
                </p>
              </section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
              <section className="nomi-card p-6 md:p-7">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setMonth((m) => addMonths(m, -1))}
                    className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[12px] font-semibold hover:bg-white transition"
                    style={{ color: "var(--muted)" }}
                  >
                    ←
                  </button>

                  <div className="text-center">
                    <p className="text-[11px] font-semibold tracking-[0.14em]" style={{ color: "var(--pink)" }}>
                      CALENDAR
                    </p>
                    <p className="mt-1 text-[14px] font-semibold text-[#0f0f12]">{fmtMonth(month)}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMonth((m) => addMonths(m, 1))}
                    className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[12px] font-semibold hover:bg-white transition"
                    style={{ color: "var(--muted)" }}
                  >
                    →
                  </button>
                </div>

                <div
                  className="mt-4 grid grid-cols-7 gap-2 text-[11px] font-semibold"
                  style={{ color: "rgba(95,96,107,0.85)" }}
                >
                  {["日", "月", "火", "水", "木", "金", "土"].map((d) => (
                    <div key={d} className="text-center">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-2">
                  {calendarCells.map((d) => {
                    const key = ymd(d);
                    const inMonth = d.getMonth() === month.getMonth();
                    const isSelected = key === selectedYmd;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedYmd(key)}
                        className={cx(
                          "h-12 rounded-2xl border text-[12px] font-semibold transition",
                          inMonth ? "bg-white/80" : "bg-white/50 opacity-60",
                          isSelected
                            ? "border-[rgba(255,59,122,0.35)] bg-[rgba(255,59,122,0.10)]"
                            : "border-black/10 hover:bg-white"
                        )}
                        style={{ color: inMonth ? "#0f0f12" : "rgba(95,96,107,0.85)" }}
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-4 text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                  選んだ日付：<span className="font-semibold text-[#0f0f12]">{fmtDateJP(selectedDateObj)}</span>
                </p>
              </section>

              <section className="nomi-card p-6 md:p-7">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.18em]" style={{ color: "var(--pink)" }}>
                      PICK
                    </p>
                    <h2 className="mt-2 text-[16px] font-semibold text-[#0f0f12]">時間帯を選ぶ（範囲）</h2>
                    <p className="mt-2 text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                      例）18:00〜20:00。
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => save("draft")}
                      disabled={saving}
                      className={cx(
                        "rounded-full px-4 py-2 text-[12px] font-semibold transition",
                        "border border-black/10 bg-white/75 hover:bg-white",
                        saving && "opacity-60 cursor-not-allowed"
                      )}
                      style={{ color: "var(--muted)" }}
                    >
                      {saving ? "保存中…" : "下書き保存"}
                    </button>

                    <button
                      type="button"
                      onClick={() => save("submitted")}
                      disabled={saving || candidates.length === 0}
                      className={cx(
                        "rounded-full px-4 py-2 text-[12px] font-semibold transition",
                        "border border-[rgba(255,59,122,0.22)]",
                        "bg-[linear-gradient(135deg,rgba(255,47,114,0.14)_0%,rgba(255,91,141,0.10)_55%,rgba(255,157,184,0.10)_100%)]",
                        (saving || candidates.length === 0)
                          ? "opacity-60 cursor-not-allowed"
                          : "hover:bg-white/80"
                      )}
                      style={{ color: "var(--pink)" }}
                    >
                      提出する
                    </button>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-black/10 bg-white/70 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                    <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
                      開始
                      <TimeSelect value={startHHMM} onChange={setStartHHMM} options={TIMES_30MIN} />
                    </label>

                    <label className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
                      終了
                      <TimeSelect value={endHHMM} onChange={setEndHHMM} options={[...TIMES_30MIN, "24:00"]} />
                    </label>

                    <button
                      type="button"
                      onClick={() => applyRangeAdd(startHHMM, endHHMM)}
                      className={cx(
                        "h-10 rounded-xl px-5 text-[12px] font-semibold transition",
                        "border border-[rgba(255,59,122,0.22)]",
                        "bg-[linear-gradient(135deg,rgba(255,47,114,0.14)_0%,rgba(255,91,141,0.10)_55%,rgba(255,157,184,0.10)_100%)]",
                        "hover:bg-white/80"
                      )}
                      style={{ color: "var(--pink)" }}
                    >
                      追加
                    </button>
                  </div>

                  <div className="mt-4">
                    <p
                      className="text-[11px] font-semibold tracking-[0.12em]"
                      style={{ color: "rgba(95,96,107,0.85)" }}
                    >
                      QUICK
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {QUICK_RANGES.map((q) => (
                        <button
                          key={q.label}
                          type="button"
                          onClick={() => {
                            setStartHHMM(q.start);
                            setEndHHMM(q.end);
                            applyRangeAdd(q.start, q.end);
                          }}
                          className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[11px] font-semibold hover:bg-white transition"
                          style={{ color: "rgba(95,96,107,0.85)" }}
                        >
                          {q.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px]" style={{ color: "rgba(95,96,107,0.75)" }}>
                      ※チップは「そのまま追加」されます
                    </p>
                  </div>

                  {!!statusText && (
                    <p
                      className="mt-3 text-[12px] font-semibold"
                      style={{ color: statusText.includes("失敗") ? "rgba(255,47,114,0.95)" : "var(--pink)" }}
                    >
                      {statusText}
                    </p>
                  )}
                </div>

                <div className="mt-5 rounded-2xl border border-black/10 bg-white/70 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-[#0f0f12]">
                      候補日時（{candidates.length}/20）
                      {docStatus === "submitted" && (
                        <span className="ml-2 text-[11px] font-semibold" style={{ color: "var(--pink)" }}>
                          提出済み
                        </span>
                      )}
                    </p>

                    {candidates.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setCandidates([])}
                        className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[11px] font-semibold hover:bg-white transition"
                        style={{ color: "rgba(95,96,107,0.85)" }}
                        title="全部削除"
                      >
                        クリア
                      </button>
                    )}
                  </div>

                  {candidates.length === 0 ? (
                    <p className="mt-2 text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                      まだありません。日付 → 開始/終了で追加してね。
                    </p>
                  ) : (
                    <div className="mt-3 space-y-3">
                      {groupCandidates(candidates).map(({ datePart, items }) => {
                        const [Y, M, D] = datePart.split("-").map(Number);
                        const d = new Date(Y, (M ?? 1) - 1, D ?? 1);
                        const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
                        const dateLabel = `${M}/${D}(${w})`;

                        return (
                          <div key={datePart} className="rounded-2xl border border-black/10 bg-white/75 p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>
                                {dateLabel}
                              </p>

                              <button
                                type="button"
                                onClick={() => {
                                  const set = new Set(items);
                                  setCandidates((prev) => prev.filter((x) => !set.has(x)));
                                }}
                                className="text-[11px] font-semibold hover:opacity-80"
                                style={{ color: "rgba(95,96,107,0.75)" }}
                                title="この日を全削除"
                              >
                                この日をクリア
                              </button>
                            </div>

                            <div className="mt-2 flex flex-wrap gap-2">
                              {items.map((c) => (
                                <span
                                  key={c}
                                  className="inline-flex items-center gap-2 rounded-full border border-[rgba(255,59,122,0.18)] bg-[rgba(255,59,122,0.06)] px-3 py-1 text-[12px] font-semibold"
                                  style={{ color: "rgba(95,96,107,0.90)" }}
                                >
                                  {formatCandidateJP(c).split(" ").slice(1).join(" ")}
                                  <button
                                    type="button"
                                    onClick={() => removeCandidate(c)}
                                    className="grid h-5 w-5 place-items-center rounded-full border border-[rgba(255,59,122,0.22)] bg-white/80 hover:bg-white transition"
                                    style={{ color: "var(--pink)" }}
                                    aria-label="削除"
                                    title="削除"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-4">
                    <label className="block text-[12px] font-semibold text-[#0f0f12]">補足メモ（任意）</label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={3}
                      className="mt-2 w-full rounded-2xl border border-black/10 bg-white/85 px-4 py-3 text-[12px] outline-none focus:ring-2 focus:ring-[rgba(255,59,122,0.22)]"
                      placeholder="例）面接はオンライン希望、夜遅めOK、日曜NG など"
                    />
                  </div>
                </div>
              </section>
            </div>

            <section className="mt-6 nomi-card p-6 md:p-7">
              <p className="text-[11px] font-semibold tracking-[0.18em]" style={{ color: "var(--pink)" }}>
                FLOW
              </p>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
                候補を提出 → 運営が日程を確定して入力 → 確定内容がこのページ上部に表示されます。
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
