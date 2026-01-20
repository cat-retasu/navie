// app/admin/requests/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { getDbClient } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ReqStatus = "draft" | "submitted" | "confirmed";

type Req = {
  id: string; // uid
  userId: string;
  status: ReqStatus;
  candidates: string[]; // "YYYY-MM-DDTHH:00|30"
  note?: string;
  confirmed?: {
    type: "interview" | "trial";
    start: string;
    end: string;
    place?: string;
  } | null;
  updatedAt?: any;
  submittedAt?: any;
  confirmedAt?: any;
};

function isHalfHourKey(s: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:(00|30)$/.test(s);
}

function parseKeyToDateLocal(key: string): Date | null {
  // "YYYY-MM-DDTHH:MM" → ローカルDate（安全パース）
  if (!isHalfHourKey(key)) return null;
  const [datePart, timePart] = key.split("T");
  const [Y, M, D] = datePart.split("-").map((v) => Number(v));
  const [hh, mm] = timePart.split(":").map((v) => Number(v));
  if (!Y || !M || !D) return null;
  return new Date(Y, M - 1, D, hh ?? 0, mm ?? 0, 0, 0);
}

function addMinutesKey(startKey: string, minutes: number): string | null {
  const d = parseKeyToDateLocal(startKey);
  if (!d) return null;
  d.setMinutes(d.getMinutes() + minutes);

  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");

  // 30分刻みのみ許可（念のため）
  if (!(mm === "00" || mm === "30")) return null;
  return `${Y}-${M}-${D}T${hh}:${mm}`;
}

function toJPLabel(key: string) {
  // "YYYY-MM-DDTHH:MM" → "M/D(曜) HH:MM"
  const d = parseKeyToDateLocal(key);
  if (!d) return key;
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  const M = d.getMonth() + 1;
  const D = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${M}/${D}(${w}) ${hh}:${mm}`;
}

function badge(status: ReqStatus) {
  const label = status === "submitted" ? "提出" : status === "confirmed" ? "確定" : "下書き";
  const strong = status === "submitted" || status === "confirmed";
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold border"
      style={{
        borderColor: strong ? "rgba(255,59,122,0.35)" : "rgba(0,0,0,0.10)",
        background: strong ? "rgba(255,59,122,0.10)" : "rgba(255,255,255,0.7)",
        color: strong ? "var(--pink)" : "rgba(95,96,107,0.85)",
      }}
    >
      {label}
    </span>
  );
}

export default function AdminRequestsPage() {
  const router = useRouter();
  const db = useMemo(() => getDbClient(), []);
  const { user, userData, loading } = useAuth();

  const [raw, setRaw] = useState<Req[]>([]);
  const [tab, setTab] = useState<"submitted" | "confirmed">("submitted");
  const [qText, setQText] = useState("");

  const [selected, setSelected] = useState<Req | null>(null);

  // 確定入力フォーム
  const [type, setType] = useState<"interview" | "trial">("interview");
  const [start, setStart] = useState<string>(""); // key
  const [duration, setDuration] = useState<number>(60); // minutes
  const [end, setEnd] = useState<string>(""); // key（自動計算）
  const [place, setPlace] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // admin guard
  useEffect(() => {
    if (loading) return;
    if (!user) return void router.replace("/login");
    if (userData?.role !== "admin") return void router.replace("/dashboard");
  }, [user, userData, loading, router]);

  // 一覧購読（whereを避けて index 要求を減らす）
  useEffect(() => {
    if (!db) return;

    const qy = query(collection(db, "interviewRequests"), orderBy("updatedAt", "desc"), limit(200));
    const unsub = onSnapshot(
      qy,
      (snap) => {
        const next: Req[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            userId: data.userId ?? d.id,
            status: (data.status ?? "draft") as ReqStatus,
            candidates: Array.isArray(data.candidates) ? data.candidates : [],
            note: typeof data.note === "string" ? data.note : "",
            confirmed: data.confirmed ?? null,
            updatedAt: data.updatedAt ?? null,
            submittedAt: data.submittedAt ?? null,
            confirmedAt: data.confirmedAt ?? null,
          };
        });

        setRaw(next);

        // 選択中の更新追従
        if (selected) {
          const hit = next.find((x) => x.id === selected.id);
          if (hit) setSelected(hit);
        }
      },
      (err) => {
        setMsg(err?.message ? `読み込みエラー: ${err.message}` : "読み込みエラー");
      }
    );

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  const items = useMemo(() => {
    const byTab = raw.filter((r) => r.status === tab);
    const s = qText.trim();
    if (!s) return byTab;
    return byTab.filter((r) => (r.userId ?? "").includes(s) || (r.id ?? "").includes(s));
  }, [raw, tab, qText]);

  const open = (r: Req) => {
    setSelected(r);
    setMsg("");

    // フォーム初期化：確定があればそれ優先、なければ候補先頭
    const baseStart = r.confirmed?.start ?? r.candidates[0] ?? "";
    setType(r.confirmed?.type ?? "interview");
    setStart(baseStart);
    setDuration(60);
    setEnd(r.confirmed?.end ?? (baseStart ? addMinutesKey(baseStart, 60) ?? "" : ""));
    setPlace(r.confirmed?.place ?? "");
  };

  // start / duration が変わったら end 自動更新（ただし start が空なら何もしない）
  useEffect(() => {
    if (!start) return;
    const next = addMinutesKey(start, duration);
    if (next) setEnd(next);
  }, [start, duration]);

  const pickStartFromCandidate = (key: string) => {
    setStart(key);
    const next = addMinutesKey(key, duration);
    if (next) setEnd(next);
  };

  const saveConfirm = async () => {
    if (!db || !selected) return;

    setMsg("");

    if (!isHalfHourKey(start) || !isHalfHourKey(end)) {
      setMsg("start/end が不正です（YYYY-MM-DDTHH:00|30）");
      return;
    }

    const dStart = parseKeyToDateLocal(start);
    const dEnd = parseKeyToDateLocal(end);
    if (!dStart || !dEnd) {
      setMsg("日時のパースに失敗しました");
      return;
    }
    if (dEnd <= dStart) {
      setMsg("終了は開始より後にしてね");
      return;
    }

    setSaving(true);
    try {
      // 1) interviewRequests を confirmed に更新
      await setDoc(
        doc(db, "interviewRequests", selected.id),
        {
          status: "confirmed",
          confirmed: {
            type,
            start,
            end,
            place: place.trim(),
          },
          confirmedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      // 2) appointments に積む（ユーザー側カレンダー表示用：後で使える）
      // いらなければこの addDoc ブロックを削ってOK
      await addDoc(collection(db, "appointments"), {
        userId: selected.id,
        type,
        startAt: Timestamp.fromDate(dStart),
        endAt: Timestamp.fromDate(dEnd),
        startKey: start,
        endKey: end,
        place: place.trim(),
        createdBy: "admin",
        createdAt: serverTimestamp(),
      });

      setMsg("確定しました ✅（appointments も追加）");
    } catch (e: any) {
      setMsg(e?.message ? `保存に失敗: ${e.message}` : "保存に失敗しました");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3500);
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
    <main className="min-h-screen bg-white text-[#0f0f12] px-4 py-10">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.18em]" style={{ color: "var(--pink)" }}>
              REQUESTS
            </p>
            <h1 className="mt-1 text-xl font-semibold">面接 / 体入の確定</h1>
            <p className="mt-1 text-[12px]" style={{ color: "rgba(95,96,107,0.85)" }}>
              候補をクリック → 開始に反映 → 所要時間で終了を自動 → 確定保存
            </p>
          </div>

          <button
            onClick={() => router.push("/admin")}
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-[12px] font-semibold hover:bg-black/[0.02] transition"
            style={{ color: "var(--muted)" }}
          >
            管理TOPへ
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
          {/* List */}
          <section className="rounded-3xl border border-black/10 bg-white p-5">
            {/* Tabs + Search */}
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex rounded-full border border-black/10 bg-white/80 p-1">
                {(["submitted", "confirmed"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={cx(
                      "rounded-full px-4 py-2 text-[12px] font-semibold transition",
                      tab === t ? "bg-[rgba(255,59,122,0.10)]" : "hover:bg-black/[0.02]"
                    )}
                    style={{ color: tab === t ? "var(--pink)" : "rgba(95,96,107,0.85)" }}
                  >
                    {t === "submitted" ? "提出" : "確定"}
                  </button>
                ))}
              </div>

              <input
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                placeholder="uid検索"
                className="h-10 w-[160px] rounded-full border border-black/10 bg-white px-4 text-[12px] outline-none focus:ring-2 focus:ring-[rgba(255,59,122,0.20)]"
              />
            </div>

            <p className="mt-3 text-[12px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
              {tab === "submitted" ? "提出" : "確定"}（{items.length}）
            </p>

            <div className="mt-3 space-y-2">
              {items.map((r) => {
                const isActive = selected?.id === r.id;
                const topLine =
                  r.status === "confirmed" && r.confirmed?.start
                    ? `${toJPLabel(r.confirmed.start)}`
                    : r.candidates[0]
                    ? `${toJPLabel(r.candidates[0])}〜`
                    : "候補なし";

                return (
                  <button
                    key={r.id}
                    onClick={() => open(r)}
                    className={cx(
                      "w-full text-left rounded-2xl border p-4 transition",
                      isActive ? "border-[rgba(255,59,122,0.35)] bg-[rgba(255,59,122,0.08)]" : "border-black/10 bg-white hover:bg-black/[0.02]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[13px] font-semibold">{r.userId}</div>
                      {badge(r.status)}
                    </div>
                    <div className="mt-1 text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                      {topLine} ・ 候補 {r.candidates.length} 件
                    </div>
                  </button>
                );
              })}

              {items.length === 0 && (
                <div className="rounded-2xl border border-black/10 bg-white/60 p-4 text-[12px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                  まだありません
                </div>
              )}
            </div>
          </section>

          {/* Detail */}
          <section className="rounded-3xl border border-black/10 bg-white p-5">
            {!selected ? (
              <div className="text-[12px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                左のリストから選んでね
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-semibold">{selected.userId}</div>
                    <div className="mt-2">{badge(selected.status)}</div>
                  </div>

                  {!!msg && (
                    <span className="text-[12px] font-semibold" style={{ color: msg.includes("失敗") || msg.includes("エラー") ? "rgba(255,47,114,0.95)" : "var(--pink)" }}>
                      {msg}
                    </span>
                  )}
                </div>

                {/* Candidates */}
                <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold">候補（クリックで開始にセット）</p>
                    <p className="text-[11px]" style={{ color: "rgba(95,96,107,0.75)" }}>
                      {selected.candidates.length}件
                    </p>
                  </div>

                  {selected.note ? (
                    <p className="mt-2 text-[12px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                      メモ：{selected.note}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {selected.candidates
                      .slice()
                      .sort((a, b) => a.localeCompare(b))
                      .map((c) => {
                        const active = c === start;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => pickStartFromCandidate(c)}
                            className={cx(
                              "rounded-full border px-3 py-1 text-[12px] font-semibold transition",
                              active
                                ? "border-[rgba(255,59,122,0.35)] bg-[rgba(255,59,122,0.10)]"
                                : "border-black/10 bg-white/80 hover:bg-white"
                            )}
                            style={{ color: active ? "var(--pink)" : "rgba(95,96,107,0.90)" }}
                            title={c}
                          >
                            {toJPLabel(c)}
                          </button>
                        );
                      })}

                    {selected.candidates.length === 0 && (
                      <div className="text-[12px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                        候補がありません
                      </div>
                    )}
                  </div>
                </div>

                {/* Confirm form */}
                <div className="mt-4 rounded-2xl border border-black/10 bg-white p-4">
                  <p className="text-[12px] font-semibold">確定入力</p>

                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-[12px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                      種別
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as any)}
                        className="mt-2 h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-[12px] font-semibold outline-none focus:ring-2 focus:ring-[rgba(255,59,122,0.20)]"
                      >
                        <option value="interview">面接</option>
                        <option value="trial">体験入店</option>
                      </select>
                    </label>

                    <label className="text-[12px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                      場所（任意）
                      <input
                        value={place}
                        onChange={(e) => setPlace(e.target.value)}
                        className="mt-2 h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-[12px] font-semibold outline-none focus:ring-2 focus:ring-[rgba(255,59,122,0.20)]"
                        placeholder="例）オンライン / 渋谷"
                      />
                    </label>

                    <label className="text-[12px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                      開始（候補クリックで入る）
                      <input
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                        className="mt-2 h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-[12px] font-semibold outline-none focus:ring-2 focus:ring-[rgba(255,59,122,0.20)]"
                        placeholder="YYYY-MM-DDTHH:00"
                      />
                    </label>

                    <label className="text-[12px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                      終了（自動）
                      <input
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                        className="mt-2 h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-[12px] font-semibold outline-none focus:ring-2 focus:ring-[rgba(255,59,122,0.20)]"
                        placeholder="YYYY-MM-DDTHH:00"
                      />
                    </label>
                  </div>

                  {/* Duration */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-[12px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                      所要時間
                    </span>

                    {[30, 60, 90, 120].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDuration(m)}
                        className={cx(
                          "rounded-full border px-4 py-2 text-[12px] font-semibold transition",
                          duration === m
                            ? "border-[rgba(255,59,122,0.35)] bg-[rgba(255,59,122,0.10)]"
                            : "border-black/10 bg-white/80 hover:bg-white"
                        )}
                        style={{ color: duration === m ? "var(--pink)" : "rgba(95,96,107,0.85)" }}
                      >
                        {m}分
                      </button>
                    ))}

                    {start && end && (
                      <span className="ml-1 text-[12px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                        → {toJPLabel(start)} 〜 {toJPLabel(end)}
                      </span>
                    )}
                  </div>

                  <div className="mt-4">
                    <button
                      onClick={saveConfirm}
                      disabled={saving || !selected}
                      className={cx(
                        "w-full rounded-2xl px-5 py-3 text-[13px] font-semibold transition",
                        "border border-[rgba(255,59,122,0.22)]",
                        "bg-[linear-gradient(135deg,rgba(255,47,114,0.14)_0%,rgba(255,91,141,0.10)_55%,rgba(255,157,184,0.10)_100%)]",
                        saving ? "opacity-60 cursor-not-allowed" : "hover:bg-white/80"
                      )}
                      style={{ color: "var(--pink)" }}
                    >
                      {saving ? "保存中…" : "確定して保存"}
                    </button>

                    <p className="mt-2 text-[11px]" style={{ color: "rgba(95,96,107,0.75)" }}>
                      ※確定すると interviewRequests が更新され、appointments にも記録されます（カレンダー表示で使える）
                    </p>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
