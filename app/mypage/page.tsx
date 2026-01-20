// app/mypage/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getDbClient } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import NavieBg from "@/components/NavieBg";
import NavieButton from "@/components/NavieButton";

type ExperienceLevel = "none" | "cabaret" | "girls_bar" | "lounge";

type ProfileDoc = {
  iconUrl?: string;
  selfIntro?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function MyPage() {
  const router = useRouter();
  const { user, userData, loading, logout } = useAuth();
  const db = useMemo(() => getDbClient(), []);

  const [profile, setProfile] = useState<ProfileDoc | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  // ログインチェック（pendingは運用するのでここで弾く）
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

  // profiles コレクション購読（アイコン & 自己紹介のみ）
    useEffect(() => {
    if (!user || !db) return;

    const ref = doc(db, "profiles", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as ProfileDoc) : null);
        setProfileLoading(false);
      },
      () => setProfileLoading(false)
    );

    return () => unsub();
  }, [user, db]);


  const extra: any = userData ?? {};

  const experienceLabel = useMemo(() => {
    const level: ExperienceLevel | undefined = extra.experienceLevel;
    switch (level) {
      case "none":
        return "未経験";
      case "cabaret":
        return "キャバ経験あり";
      case "girls_bar":
        return "ガールズバー経験あり";
      case "lounge":
        return "ラウンジ経験あり";
      default:
        return "未回答";
    }
  }, [extra.experienceLevel]);

  const formattedBirth = useMemo(() => {
    if (!extra.birthDate) return "未登録";
    try {
      const d = new Date(extra.birthDate);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}年${m}月${day}日`;
    } catch {
      return extra.birthDate;
    }
  }, [extra.birthDate]);

  const ageText = useMemo(() => {
    if (!extra.birthDate) return undefined;
    const d = new Date(extra.birthDate);
    if (Number.isNaN(d.getTime())) return undefined;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return age >= 0 && age <= 100 ? `${age}歳` : undefined;
  }, [extra.birthDate]);

  const isLoadingAll = loading || profileLoading || !user || !userData;

  // 希望条件のどれか1つでも入っているか
  const hasPreference =
    !!extra.currentJob ||
    !!extra.area ||
    !!extra.residenceStation ||
    !!extra.preferredShift ||
    !!extra.preferredJobType ||
    !!extra.preferredHourlyWage;

  return (
    <main className="min-h-screen text-[#0f0f12] relative overflow-hidden">
      {/* 背景（LP/loginと同系統） */}
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
        {/* md以上：上品な外枠 */}
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
            {/* ヘッダー */}
            <header className="mb-6">
              <div className="flex items-center justify-between">
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

                <Link
                href="/dashboard"
                className="hidden md:inline-flex items-center justify-center rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs font-semibold hover:bg-white transition"
                style={{ color: "var(--muted)" }}
              >
                戻る
              </Link>
              </div>

              <p className="mt-5 text-[11px] font-semibold tracking-[0.18em]" style={{ color: "var(--pink)" }}>
                MY PAGE
              </p>
              <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-[#0f0f12]">
                プロフィール確認
              </h1>
              <p className="mt-2 text-xs md:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                登録内容は店舗紹介の参考にします。変更したい場合は編集画面へ。
              </p>
            </header>

            {/* 右上：編集ボタン */}
            <div className="mb-5 flex justify-end">
              <NavieButton href="/mypage/edit" className="h-[46px] px-6 text-[13px]">
                プロフィールを編集する
              </NavieButton>
            </div>

            {/* メイン：プロフィールカード */}
            <section className="nomi-card p-6 md:p-7">
              {isLoadingAll ? (
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  読み込み中…
                </p>
              ) : (
                <>
                  {/* 上段 */}
                  <div className="flex flex-col md:flex-row gap-6">
                    {/* 写真 */}
                    <div className="shrink-0">
                      {profile?.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={profile.iconUrl}
                          className="h-24 w-24 rounded-full object-cover border border-black/10 bg-white/70"
                          alt="プロフィール画像"
                        />
                      ) : (
                        <div className="h-24 w-24 rounded-full border border-black/10 bg-white/70 flex items-center justify-center text-[10px]"
                          style={{ color: "rgba(95,96,107,0.75)" }}
                        >
                          画像未登録
                        </div>
                      )}
                    </div>

                    {/* 基本情報 */}
                    <div className="flex-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <p className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                            呼び名（ニックネーム）
                          </p>
                          <p className="mt-1 text-[14px] font-semibold text-[#0f0f12]">
                            {extra.nickname || "未登録"}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                            生年月日
                          </p>
                          <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
                            {formattedBirth}{" "}
                            {ageText && (
                              <span className="ml-2 text-[11px]" style={{ color: "rgba(95,96,107,0.75)" }}>
                                ({ageText})
                              </span>
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                            住まい（最寄駅）
                          </p>
                          <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
                            {extra.residenceStation || "未登録"}
                          </p>
                        </div>

                        <div>
                          <p className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                            夜職の経験
                          </p>
                          <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
                            {experienceLabel}
                          </p>
                        </div>

                        <div className="sm:col-span-2">
                          <p className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                            登録メールアドレス
                          </p>
                          <p className="mt-1 text-[12px] break-all" style={{ color: "rgba(95,96,107,0.92)" }}>
                            {userData?.email || "未登録"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 経験者項目 */}
                  {(extra.experienceLevel === "cabaret" ||
                    extra.experienceLevel === "girls_bar" ||
                    extra.experienceLevel === "lounge") && (
                    <>
                      <div className="my-6 h-px w-full bg-black/10" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          ["経験年数", extra.experienceYears],
                          ["経験店舗（店名／エリア）", extra.experienceShops],
                          ["平均売上", extra.averageSales],
                          ["過去最高売上", extra.maxSales],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <p className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                              {label}
                            </p>
                            <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
                              {value || "未登録"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* 希望条件 */}
                  {hasPreference && (
                    <>
                      <div className="my-6 h-px w-full bg-black/10" />
                      <p className="text-[11px] font-semibold tracking-[0.14em]" style={{ color: "var(--pink)" }}>
                        PREFERENCES
                      </p>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {extra.currentJob && (
                          <div>
                            <p className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                              現職
                            </p>
                            <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
                              {extra.currentJob}
                            </p>
                          </div>
                        )}

                        {extra.area && (
                          <div>
                            <p className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                              希望エリア
                            </p>
                            <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
                              {extra.area}
                            </p>
                          </div>
                        )}

                        {extra.preferredShift && (
                          <div>
                            <p className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                              希望シフト
                            </p>
                            <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
                              {extra.preferredShift}
                            </p>
                          </div>
                        )}

                        {extra.preferredJobType && (
                          <div>
                            <p className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                              希望業種
                            </p>
                            <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
                              {extra.preferredJobType}
                            </p>
                          </div>
                        )}

                        {extra.preferredHourlyWage && (
                          <div>
                            <p className="text-[11px] font-semibold" style={{ color: "rgba(95,96,107,0.85)" }}>
                              希望時給
                            </p>
                            <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>
                              {extra.preferredHourlyWage}
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* 自己紹介 */}
                  {profile?.selfIntro && (
                    <>
                      <div className="my-6 h-px w-full bg-black/10" />
                      <p className="text-[11px] font-semibold tracking-[0.14em]" style={{ color: "var(--pink)" }}>
                        ABOUT
                      </p>
                      <p className="mt-3 text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--muted)" }}>
                        {profile.selfIntro}
                      </p>
                    </>
                  )}
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
