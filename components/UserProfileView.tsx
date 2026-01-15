// components/UserProfileView.tsx

"use client";

import React, { useMemo } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-pink-300/40";

type KnownExperienceKey =
  | "none"
  | "cabaret"
  | "girls_bar"
  | "lounge"
  | "club"
  | "other";

type KnownJobTypeKey = "lounge" | "cabaret" | "girls_bar" | "club" | "other";

const experienceOptions: Array<{ key: KnownExperienceKey; label: string }> = [
  { key: "none", label: "未経験" },
  { key: "lounge", label: "ラウンジ" },
  { key: "cabaret", label: "キャバクラ" },
  { key: "girls_bar", label: "ガールズバー" },
  { key: "club", label: "クラブ" },
  { key: "other", label: "その他" },
];

const jobTypeOptions: Array<{ key: KnownJobTypeKey; label: string }> = [
  { key: "lounge", label: "ラウンジ" },
  { key: "cabaret", label: "キャバクラ" },
  { key: "girls_bar", label: "ガールズバー" },
  { key: "club", label: "クラブ" },
  { key: "other", label: "その他" },
];

function isKnownExperienceKey(v: any): v is KnownExperienceKey {
  return ["none", "cabaret", "girls_bar", "lounge", "club", "other"].includes(v);
}
function isKnownJobTypeKey(v: any): v is KnownJobTypeKey {
  return ["lounge", "cabaret", "girls_bar", "club", "other"].includes(v);
}

export function UserProfileView({
  userDoc,
  profileDoc,
}: {
  userDoc: any;
  profileDoc: any;
}) {
  // Firestore保存仕様（otherの場合は文字列そのものになる）を吸収 :contentReference[oaicite:1]{index=1}
  const experience = useMemo(() => {
    const raw = (userDoc?.experienceLevel ?? "none") as any;
    if (isKnownExperienceKey(raw)) {
      return { key: raw, otherText: "" };
    }
    // known key じゃない文字列は「その他」として扱う
    return { key: "other" as const, otherText: String(raw ?? "") };
  }, [userDoc?.experienceLevel]);

  const preferredJob = useMemo(() => {
    const raw = (userDoc?.preferredJobType ?? "") as any;
    if (isKnownJobTypeKey(raw)) {
      return { key: raw, otherText: "" };
    }
    return { key: "other" as const, otherText: String(raw ?? "") };
  }, [userDoc?.preferredJobType]);

  const showExperienceDetails = experience.key !== "none";

  return (
    <div className="space-y-6">
      {/* カード：写真（アイコン） */}
      <section className="rounded-[24px] border border-white/10 bg-[#08030f]/95 shadow-[0_20px_60px_rgba(0,0,0,0.8)] px-5 py-6 md:px-8 md:py-7">
        <h2 className="text-sm font-semibold mb-4">写真（アイコン）</h2>

        <div className="flex items-center gap-4">
          <div className="h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-black/40">
            {profileDoc?.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profileDoc.iconUrl}
                alt="icon"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">
                未設定
              </div>
            )}
          </div>

          <div className="flex-1">
            <p className="text-[11px] text-gray-400">
              ※ 管理画面では写真の変更はできません
            </p>
          </div>
        </div>
      </section>

      {/* カード：基本情報（順序も一致） :contentReference[oaicite:2]{index=2} */}
      <section className="rounded-[24px] border border-white/10 bg-[#08030f]/95 shadow-[0_20px_60px_rgba(0,0,0,0.8)] px-5 py-6 md:px-8 md:py-7 space-y-5">
        <h2 className="text-sm font-semibold">基本情報</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ViewField label="ニックネーム（必須）" value={userDoc?.nickname} />
          <ViewField label="生年月日" value={userDoc?.birthDate} />
          <ViewField label="住まい（最寄駅）" value={userDoc?.residenceStation} />
          <ViewField label="電話番号" value={userDoc?.phoneNumber} />
        </div>
      </section>

      {/* カード：経験（チップUIも一致） :contentReference[oaicite:3]{index=3} */}
      <section className="rounded-[24px] border border-white/10 bg-[#08030f]/95 shadow-[0_20px_60px_rgba(0,0,0,0.8)] px-5 py-6 md:px-8 md:py-7 space-y-5">
        <h2 className="text-sm font-semibold">経験</h2>

        <div>
          <p className="mb-2 text-[11px] text-gray-300">経験区分</p>

          <div className="flex flex-wrap gap-2">
            {experienceOptions.map((o) => {
              const active = experience.key === o.key;
              return (
                <span
                  key={o.key}
                  className={cx(
                    "rounded-full px-4 py-2 text-xs transition",
                    active
                      ? "bg-pink-500 text-white"
                      : "border border-white/20 bg-white/5 text-gray-200"
                  )}
                >
                  {o.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* その他表示 */}
        {experience.key === "other" && (
          <div>
            <input
              value={experience.otherText || "—"}
              readOnly
              className={cx(inputClass, "opacity-90")}
              placeholder="—"
            />
            <p className="mt-1 text-[10px] text-gray-500">
              ※ 経験区分（その他）
            </p>
          </div>
        )}

        {/* 未経験以外のときだけ */}
        {showExperienceDetails && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ViewField label="経験年数" value={userDoc?.experienceYears} />
            <ViewField label="経験店舗" value={userDoc?.experienceShops} />
            <ViewField label="平均売上" value={userDoc?.averageSales} />
            <ViewField label="最高売上" value={userDoc?.maxSales} />
          </div>
        )}
      </section>

      {/* カード：希望条件（チップUIも一致） :contentReference[oaicite:4]{index=4} */}
      <section className="rounded-[24px] border border-white/10 bg-[#08030f]/95 shadow-[0_20px_60px_rgba(0,0,0,0.8)] px-5 py-6 md:px-8 md:py-7 space-y-5">
        <h2 className="text-sm font-semibold">希望条件</h2>

        <div>
          <p className="mb-2 text-[11px] text-gray-300">希望業種（必須）</p>

          <div className="flex flex-wrap gap-2">
            {jobTypeOptions.map((o) => {
              const active = preferredJob.key === o.key;
              return (
                <span
                  key={o.key}
                  className={cx(
                    "rounded-full px-4 py-2 text-xs transition",
                    active
                      ? "bg-pink-500 text-white"
                      : "border border-white/20 bg-white/5 text-gray-200"
                  )}
                >
                  {o.label}
                </span>
              );
            })}
          </div>
        </div>

        {preferredJob.key === "other" && (
          <div>
            <input
              value={preferredJob.otherText || "—"}
              readOnly
              className={cx(inputClass, "opacity-90")}
              placeholder="—"
            />
            <p className="mt-1 text-[10px] text-gray-500">
              ※ 希望業種（その他）
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* mypage/editでは “input placeholder” だけど、viewはラベル付きで揃える */}
          <ViewField label="希望エリア" value={userDoc?.area} />
          <ViewField label="希望シフト" value={userDoc?.preferredShift} />
          <ViewField label="希望時給" value={userDoc?.preferredHourlyWage} />
        </div>
      </section>
    </div>
  );
}

function ViewField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] text-gray-300">{label}</label>
      <div className={cx(inputClass, "opacity-90")}>{value?.toString() || "—"}</div>
    </div>
  );
}
