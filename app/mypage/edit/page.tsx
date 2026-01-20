// app/mypage/edit/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getDbClient, getStorageClient } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import NavieBg from "@/components/NavieBg";
import NavieButton from "@/components/NavieButton";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ExperienceLevel = "none" | "cabaret" | "girls_bar" | "lounge" | "club" | "other";

export default function MyPageEditPage() {
  const router = useRouter();
  const { user, userData, loading } = useAuth();
  const db = useMemo(() => getDbClient(), []);
  const storage = useMemo(() => getStorageClient(), []);

  // --- プロフィール（users/profilesから同期してフォームに落とす） ---
  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [area, setArea] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>("none");
  const [experienceYears, setExperienceYears] = useState("");
  const [experienceShops, setExperienceShops] = useState("");
  const [averageSales, setAverageSales] = useState("");
  const [maxSales, setMaxSales] = useState("");

  const [currentJob, setCurrentJob] = useState("");
  const [residenceStation, setResidenceStation] = useState("");
  const [preferredShift, setPreferredShift] = useState("");
  const [preferredJobType, setPreferredJobType] = useState("");
  const [preferredHourlyWage, setPreferredHourlyWage] = useState("");

  // --- アイコン ---
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [savingIcon, setSavingIcon] = useState(false);

  // --- 保存/エラー ---
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  const [experienceLevelOther, setExperienceLevelOther] = useState("");
  const [preferredJobTypeOther, setPreferredJobTypeOther] = useState("");

  // ログイン・ロールガード（pendingは運用するのでここで弾く）
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

  // users/{uid} を購読してフォーム初期化（userData のソース）
  useEffect(() => {
    if (!user || !db) return;

    const refUser = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      refUser,
      (snap) => {
        const d = snap.data() as any;
        if (!d) return;

        setNickname(d.nickname ?? "");
        setBirthDate(d.birthDate ?? "");
        setArea(d.area ?? "");
        setPhoneNumber(d.phoneNumber ?? "");

        const exp = (d.experienceLevel ?? "none") as any;
        // "other" 文字列運用にも一応耐える
        if (exp === "none" || exp === "cabaret" || exp === "girls_bar" || exp === "lounge" || exp === "club" || exp === "other") {
          setExperienceLevel(exp);
          setExperienceLevelOther("");
        } else {
          setExperienceLevel("other");
          setExperienceLevelOther(String(exp ?? ""));
        }

        setExperienceYears(d.experienceYears ?? "");
        setExperienceShops(d.experienceShops ?? "");
        setAverageSales(d.averageSales ?? "");
        setMaxSales(d.maxSales ?? "");

        setCurrentJob(d.currentJob ?? "");
        setResidenceStation(d.residenceStation ?? "");
        setPreferredShift(d.preferredShift ?? "");

        const pjt = (d.preferredJobType ?? "") as any;
        if (pjt === "lounge" || pjt === "cabaret" || pjt === "girls_bar" || pjt === "club" || pjt === "other") {
          setPreferredJobType(pjt);
          setPreferredJobTypeOther("");
        } else if (pjt) {
          // 既に自由入力が入ってるケース
          setPreferredJobType("other");
          setPreferredJobTypeOther(String(pjt));
        } else {
          setPreferredJobType("");
          setPreferredJobTypeOther("");
        }

        setPreferredHourlyWage(d.preferredHourlyWage ?? "");
      },
      (err) => {
        console.error(err);
        setError("ユーザー情報の読み込みに失敗したよ");
      }
    );

    return () => unsub();
  }, [user, db]);

  // profiles/{uid} を購読（iconUrl など表示用）
  useEffect(() => {
    if (!user || !db) return;

    const refProfile = doc(db, "profiles", user.uid);
    const unsub = onSnapshot(
      refProfile,
      (snap) => {
        const d = snap.data() as any;
        setIconUrl(d?.iconUrl ?? null);
      },
      (err) => {
        console.error(err);
      }
    );

    return () => unsub();
  }, [user, db]);

  const normalizePhone = (v: string) => v.replace(/[^\d]/g, "");

  const canSave = useMemo(() => {
    if (!user) return false;
    if (saving) return false;
    if (!nickname.trim()) return false;
    return true;
  }, [user, saving, nickname]);

  // 写真変更（Storageに上書き→profiles.iconUrl更新）
  const updateIcon = async (file: File | null) => {
    if (!user || !file || !db || !storage) return;

    setError(null);
    setSavingIcon(true);

    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("画像ファイルを選択してね");
      }
      const MAX = 2 * 1024 * 1024;
      if (file.size > MAX) {
        throw new Error("画像サイズは2MB以下にしてね");
      }

      const objectRef = ref(storage, `userProfileImages/${user.uid}/icon`);
      await uploadBytes(objectRef, file, { contentType: file.type });
      const url = await getDownloadURL(objectRef);

      await setDoc(
        doc(db, "profiles", user.uid),
        {
          iconUrl: url,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "写真の更新に失敗したよ");
    } finally {
      setSavingIcon(false);
    }
  };

  // 保存：users と profiles 両方に反映
  const onSave = async () => {
    if (!user || !db) return;
    setError(null);

    if (preferredJobType === "other" && !preferredJobTypeOther.trim()) {
      setError("希望業種（その他）を入力してください");
      return;
    }

    const phone = normalizePhone(phoneNumber);

    if (!nickname.trim()) {
      setError("ニックネームを入力してね");
      return;
    }
    if (phone && (phone.length < 10 || phone.length > 11)) {
      setError("電話番号は10〜11桁（例：09012345678）で入力してね");
      return;
    }
    if (experienceLevel === "other" && !experienceLevelOther.trim()) {
      setError("経験区分（その他）を入力してください");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nickname: nickname.trim(),
        birthDate: birthDate.trim(),
        area: area.trim(),
        phoneNumber: phone,

        experienceLevel: experienceLevel === "other" ? experienceLevelOther.trim() : experienceLevel,
        experienceYears: experienceYears.trim(),
        experienceShops: experienceShops.trim(),
        averageSales: averageSales.trim(),
        maxSales: maxSales.trim(),

        currentJob: currentJob.trim(),
        residenceStation: residenceStation.trim(),
        preferredShift: preferredShift.trim(),
        preferredJobType: preferredJobType === "other" ? preferredJobTypeOther.trim() : preferredJobType,
        preferredHourlyWage: preferredHourlyWage.trim(),

        updatedAt: serverTimestamp(),
      };

      await updateDoc(doc(db, "users", user.uid), payload);

      await setDoc(
        doc(db, "profiles", user.uid),
        {
          nickname: payload.nickname,
          area: payload.area,
          phoneNumber: payload.phoneNumber,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2000);
    } catch (e) {
      console.error(e);
      setError("保存に失敗したよ。もう一度試してね");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
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
      {/* 背景（NAVIÉ） */}
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

      <div className="mx-auto w-full px-4 pb-16 pt-16 md:pt-20">
        {/* md以上：外枠 */}
        <div
          className={cx(
            "mx-auto w-full max-w-3xl",
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
          <div className="relative space-y-6">
            {/* ヘッダー */}
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.18em]" style={{ color: "var(--pink)" }}>
                  MY PAGE
                </p>
                <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-[#0f0f12]">
                  プロフィール編集
                </h1>
                <p className="mt-2 text-xs md:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                  写真・基本情報・希望条件を編集できます
                </p>
              </div>

              <Link
                href="/dashboard"
                className="hidden md:inline-flex items-center justify-center rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs font-semibold hover:bg-white transition"
                style={{ color: "var(--muted)" }}
              >
                戻る
              </Link>
            </header>

            {/* Toast */}
            {savedToast && (
              <div className="rounded-2xl border border-[rgba(255,59,122,0.25)] bg-[rgba(255,59,122,0.08)] px-4 py-3 text-xs">
                <span className="font-semibold" style={{ color: "var(--pink)" }}>
                  保存しました ✅
                </span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-2xl border border-[rgba(255,59,122,0.25)] bg-[rgba(255,59,122,0.08)] px-4 py-3 text-xs">
                <span className="font-semibold" style={{ color: "var(--pink)" }}>
                  エラー：
                </span>{" "}
                <span style={{ color: "var(--muted)" }}>{error}</span>
              </div>
            )}

            {/* 写真（アイコン） */}
            <section className="nomi-card p-6 md:p-7">
              <h2 className="text-sm font-semibold text-[#0f0f12]">写真（アイコン）</h2>

              <div className="mt-4 flex items-center gap-4">
                <div className="h-20 w-20 overflow-hidden rounded-2xl border border-black/10 bg-white/70">
                  {iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={iconUrl} alt="icon" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-xs" style={{ color: "rgba(95,96,107,0.75)" }}>
                      未設定
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <label
                    className={cx(
                      "inline-flex cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs font-semibold hover:bg-white transition",
                      savingIcon && "opacity-60 cursor-not-allowed"
                    )}
                    style={{ color: "var(--muted)" }}
                  >
                    {savingIcon ? "更新中…" : "写真を変更"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={savingIcon}
                      className="hidden"
                      onChange={(e) => updateIcon(e.target.files?.[0] ?? null)}
                    />
                  </label>

                  <p className="mt-2 text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                    2MB以下・顔が分かりやすい写真がおすすめ（後から変更OK）
                  </p>
                </div>
              </div>
            </section>

            {/* 基本情報 */}
            <section className="nomi-card p-6 md:p-7 space-y-5">
              <h2 className="text-sm font-semibold text-[#0f0f12]">基本情報</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="ニックネーム（必須）">
                  <input value={nickname} onChange={(e) => setNickname(e.target.value)} className={inputClass} placeholder="例：ゆな" />
                </Field>

                <Field label="生年月日">
                  <input value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputClass} placeholder="例：2003-04-01" />
                </Field>

                <Field label="住まい（最寄駅）">
                  <input value={residenceStation} onChange={(e) => setResidenceStation(e.target.value)} className={inputClass} placeholder="例：渋谷 / 新宿" />
                </Field>

                <Field label="電話番号">
                  <input
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className={inputClass}
                    placeholder="例：09012345678"
                    inputMode="tel"
                  />
                  <p className="mt-1 text-[10px]" style={{ color: "rgba(95,96,107,0.75)" }}>
                    ※ ハイフンなし推奨
                  </p>
                </Field>
              </div>
            </section>

            {/* 経験 */}
            <section className="nomi-card p-6 md:p-7 space-y-5">
              <h2 className="text-sm font-semibold text-[#0f0f12]">経験</h2>

              <div>
                <p className="mb-2 text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                  経験区分
                </p>

                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "none", label: "未経験" },
                    { key: "lounge", label: "ラウンジ" },
                    { key: "cabaret", label: "キャバクラ" },
                    { key: "girls_bar", label: "ガールズバー" },
                    { key: "club", label: "クラブ" },
                    { key: "other", label: "その他" },
                  ].map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => {
                        const v = o.key as ExperienceLevel;
                        setExperienceLevel(v);

                        if (v === "none") {
                          setExperienceYears("");
                          setExperienceShops("");
                          setAverageSales("");
                          setMaxSales("");
                          setExperienceLevelOther("");
                        }
                        if (v !== "other") setExperienceLevelOther("");
                      }}
                      className={cx(
                        "rounded-full px-4 py-2 text-xs font-semibold transition",
                        experienceLevel === o.key
                          ? "border border-[rgba(255,59,122,0.35)] bg-[rgba(255,59,122,0.12)]"
                          : "border border-black/10 bg-white/70 hover:bg-white"
                      )}
                      style={{ color: experienceLevel === o.key ? "var(--pink)" : "var(--muted)" }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {experienceLevel === "other" && (
                <div>
                  <input
                    value={experienceLevelOther}
                    onChange={(e) => setExperienceLevelOther(e.target.value)}
                    className={inputClass}
                    placeholder="例：いちゃキャバ / ヘルス / 芸能"
                  />
                  <p className="mt-1 text-[10px]" style={{ color: "rgba(95,96,107,0.75)" }}>
                    ※ 必須入力です
                  </p>
                </div>
              )}

              {experienceLevel !== "none" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="経験年数">
                    <input value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} className={inputClass} placeholder="例：1年 / 半年" />
                  </Field>

                  <Field label="経験店舗">
                    <input value={experienceShops} onChange={(e) => setExperienceShops(e.target.value)} className={inputClass} placeholder="例：新宿◯◯ / 銀座◯◯" />
                  </Field>

                  <Field label="平均売上">
                    <input value={averageSales} onChange={(e) => setAverageSales(e.target.value)} className={inputClass} placeholder="例：月80万" />
                  </Field>

                  <Field label="最高売上">
                    <input value={maxSales} onChange={(e) => setMaxSales(e.target.value)} className={inputClass} placeholder="例：月150万" />
                  </Field>
                </div>
              )}
            </section>

            {/* 希望条件 */}
            <section className="nomi-card p-6 md:p-7 space-y-5">
              <h2 className="text-sm font-semibold text-[#0f0f12]">希望条件</h2>

              <div>
                <p className="mb-2 text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                  希望業種（必須）
                </p>

                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "lounge", label: "ラウンジ" },
                    { key: "cabaret", label: "キャバクラ" },
                    { key: "girls_bar", label: "ガールズバー" },
                    { key: "club", label: "クラブ" },
                    { key: "other", label: "その他" },
                  ].map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      onClick={() => {
                        setPreferredJobType(o.key);
                        if (o.key !== "other") setPreferredJobTypeOther("");
                      }}
                      className={cx(
                        "rounded-full px-4 py-2 text-xs font-semibold transition",
                        preferredJobType === o.key
                          ? "border border-[rgba(255,59,122,0.35)] bg-[rgba(255,59,122,0.12)]"
                          : "border border-black/10 bg-white/70 hover:bg-white"
                      )}
                      style={{ color: preferredJobType === o.key ? "var(--pink)" : "var(--muted)" }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              {preferredJobType === "other" && (
                <div>
                  <input
                    value={preferredJobTypeOther}
                    onChange={(e) => setPreferredJobTypeOther(e.target.value)}
                    className={inputClass}
                    placeholder="例：いちゃキャバ / ヘルス / 芸能"
                  />
                  <p className="mt-1 text-[10px]" style={{ color: "rgba(95,96,107,0.75)" }}>
                    ※ 必須入力です
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="希望エリア">
                  <input value={area} onChange={(e) => setArea(e.target.value)} className={inputClass} placeholder="例：新宿 / 銀座" />
                </Field>

                <Field label="希望シフト">
                  <input value={preferredShift} onChange={(e) => setPreferredShift(e.target.value)} className={inputClass} placeholder="例：週3 / 週末のみ" />
                </Field>

                <Field label="希望時給">
                  <input value={preferredHourlyWage} onChange={(e) => setPreferredHourlyWage(e.target.value)} className={inputClass} placeholder="例：6000円〜" />
                </Field>

                <Field label="現職（任意）">
                  <input value={currentJob} onChange={(e) => setCurrentJob(e.target.value)} className={inputClass} placeholder="例：学生 / OL / フリー" />
                </Field>
              </div>
            </section>

            {/* 保存 */}
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              {/* ✅ NavieButtonはLinkなので保存はbuttonで */}
              <button
                type="button"
                onClick={onSave}
                disabled={!canSave}
                className={cx(
                  "inline-flex items-center justify-center rounded-full h-[52px] px-7 text-[14px] font-semibold transition",
                  "shadow-[0_18px_50px_rgba(255,59,122,0.26)] hover:shadow-[0_22px_60px_rgba(255,59,122,0.32)]",
                  canSave ? "bg-[#ff2f92] hover:bg-[#ff4a9f] text-white" : "bg-[#ff2f92]/55 text-white cursor-not-allowed"
                )}
              >
                {saving ? "保存中…" : "保存する"}
              </button>

              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full h-[52px] px-7 text-[14px] font-semibold transition border border-black/10 bg-white/70 hover:bg-white"
                style={{ color: "var(--muted)" }}
              >
                戻る
              </Link>

              <p className="md:ml-auto text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                変更は即時反映されます
              </p>
            </div>

            {/* モバイル用の戻る（上のリンクがhiddenなので） */}
            <div className="md:hidden pt-2">
              <Link href="/dashboard" className="text-[12px] font-semibold" style={{ color: "var(--pink)" }}>
                ← ダッシュボードへ戻る
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-[#0f0f12] placeholder:text-[#9aa0aa] outline-none focus:border-[rgba(255,59,122,0.45)]";