// app/page.tsx

import NavieBg from "@/components/NavieBg";
import NavieButton from "@/components/NavieButton";
import Image from "next/image";
import { Fragment } from "react";

type Tone = "white" | "blush";

function SectionShell({
  tone,
  children,
  id,
  className = "",
}: {
  tone: Tone;
  children: React.ReactNode;
  id?: string;
  className?: string;
}) {
  const bg =
    tone === "white"
      ? "bg-white/64"
      : "bg-[rgba(255,249,251,0.72)]";

  return (
    <section id={id} className={`relative scroll-mt-24 ${className}`}>
      <div className={`absolute inset-0 ${bg}`} />
      <div className="relative">{children}</div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen text-[#0f0f12]">
      <NavieBg />

      {/* ✅ Hero（FULL：100svh） */}
      <SectionShell id="top" tone="white" className="pt-0 pb-0">
        {/* ✅ 画面いっぱい */}
        <div className="relative overflow-hidden h-[100svh]">
          {/* 背景（全幅） */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage: `
                radial-gradient(1200px 820px at 18% 54%, rgba(255,59,122,0.58), transparent 62%),
                radial-gradient(900px 760px at 52% 52%, rgba(255,140,175,0.22), transparent 70%),
                radial-gradient(1100px 780px at 82% 38%, rgba(255,255,255,0.78), transparent 58%),
                radial-gradient(1000px 720px at 62% 92%, rgba(255,59,122,0.20), transparent 62%),
                linear-gradient(90deg,
                  rgba(255,64,120,0.96) 0%,
                  rgba(255,112,156,0.90) 34%,
                  rgba(255,235,244,0.92) 66%,
                  rgba(255,255,255,0.92) 100%
                )
              `,
            }}
          />

          {/* ✅ スマホ版：フルブリード */}
          <div className="md:hidden absolute inset-0 -mx-4">
            <Image
              src="/hero/mero.png"
              alt="NAVIÉ イメージビジュアル"
              fill
              priority
              sizes="100vw"
              className="object-cover object-[55%_14%]"
            />

            {/* 可読性：上薄め / 下濃い */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background: `
                  linear-gradient(180deg,
                    rgba(255,255,255,0.10) 0%,
                    rgba(255,255,255,0.02) 45%,
                    rgba(255,59,122,0.10) 72%,
                    rgba(255,59,122,0.58) 100%
                  ),
                  radial-gradient(120% 90% at 50% 100%,
                    rgba(255,59,122,0.80) 0%,
                    rgba(255,59,122,0.18) 52%,
                    rgba(255,59,122,0) 78%
                  )
                `,
              }}
            />

            {/* 下：CTA（bottom固定 + safe-area） */}
            <div className="absolute inset-x-0 bottom-0 px-4 pb-[max(14px,env(safe-area-inset-bottom))]">
              <div className="mx-auto max-w-[560px]">
                <div className="rounded-[28px] border border-white/60 bg-white/72 backdrop-blur-[16px] shadow-[0_26px_90px_rgba(18,18,24,0.16)] overflow-hidden">
                  <div className="p-5">
                    <h1
                      className="mt-2 text-center text-[34px] leading-[1.05] tracking-[-0.02em] text-[#0f0f12] font-black"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      NAVIÉ
                    </h1>

                    <div
                      className="mt-4 h-[3px] w-[68%] rounded-full mx-auto"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(255,59,122,1) 0%, rgba(255,59,122,0.12) 60%, rgba(255,59,122,0.02) 100%)",
                      }}
                    />

                    <p
                      className="mt-3 text-[12.5px] leading-relaxed"
                      style={{ color: "rgba(95,96,107,0.92)" }}
                    >
                      水商売・接客系・芸能系など、夜のお仕事の求人を
                      <br />
                      担当者とチャットで相談しながら探せます。
                    </p>

                    {/* ✅ 要素最小：新規登録 / ログイン */}
                    <div className="mt-4 flex flex-col gap-2.5">
                      <NavieButton
                        href="/login?tab=signup"
                        className="w-full justify-center text-[13px] py-3 rounded-full"
                      >
                        新規登録
                      </NavieButton>

                      <a
                        href="/login"
                        className="w-full inline-flex justify-center text-[12px] font-semibold py-2.5 rounded-full border border-[rgba(255,59,122,0.22)] bg-white/70"
                        style={{ color: "var(--pink)" }}
                      >
                        ログイン
                      </a>
                    </div>

                    <p
                      className="mt-3 text-[10px]"
                      style={{ color: "rgba(95,96,107,0.88)" }}
                    >
                      ※ 無理な連絡や、強引な勧誘はありません
                    </p>
                  </div>

                  {/* 下に艶（整う） */}
                  <div
                    aria-hidden
                    className="h-3"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(255,59,122,0.20), rgba(255,255,255,0.00))",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ✅ PCは今は空でOK（必要なら後でLP戻す） */}
        </div>
      </SectionShell>

      {/* JSON-LD（そのまま） */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "NAVIÉ",
            description:
              "水商売・接客系・芸能系など、夜のお仕事の求人を担当者とチャットで相談しながら探せるサービス。",
            url: "https://example.com",
          }),
        }}
      />
    </main>
  );
}
