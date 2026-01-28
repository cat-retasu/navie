// app/page.tsx

import NavieBg from "@/components/NavieBg";
import NavieButton from "@/components/NavieButton";
import Image from "next/image";
import ScrollSpyHeader from "@/components/ScrollSpyHeader";
import { Fragment } from "react";
import SectionDivider from "@/components/SectionDivider";
import Reveal from "@/components/reveal";

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
    <section
      id={id}
      className={`relative scroll-mt-24 ${className}`}
    >
      {/* full-width tone layer */}
      <div className={`absolute inset-0 ${bg}`} />
      <div className="relative">{children}</div>
    </section>
  );
}

function Section({
  id,
  kicker,
  title,
  lead,
  children,
  tone = "white",
}: {
  id?: string;
  kicker?: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <SectionShell id={id} tone={tone} className="py-16 md:py-24">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="max-w-3xl">
          {kicker && (
            <p
              className="text-[12px] font-semibold tracking-[0.18em]"
              style={{ color: "var(--pink)" }}
            >
              {kicker}
            </p>
          )}
          <h2 className="mt-2 text-2xl md:text-4xl font-semibold tracking-tight text-[#0f0f12]">
            {title}
          </h2>
          {lead && (
            <p className="mt-4 text-sm md:text-base leading-relaxed" style={{ color: "var(--muted)" }}>
              {lead}
            </p>
          )}
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </SectionShell>
  );
}

function Card({
  title,
  body,
  tag = "FEATURE",
}: {
  title: string;
  body: string;
  tag?: string;
}) {
  return (
    <div className="nomi-card p-6">
      <p className="text-[11px] font-semibold tracking-[0.22em]" style={{ color: "var(--pink)" }}>
        {tag}
      </p>
      <p className="mt-2 text-[15px] font-semibold text-[#0f0f12]">{title}</p>
      <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
        {body}
      </p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen text-[#0f0f12]">
      <NavieBg />
      <ScrollSpyHeader />

      {/* Hero（white / FULL WIDTH） */}
<SectionShell id="top" tone="white" className="pt-0 pb-12 md:pb-20">
  {/* ✅ full-bleed wrapper：1画面に収める（ヘッダー分を引く） */}
  <div className="relative overflow-hidden h-[calc(100svh-124px)] md:h-[calc(100svh-80px)]">
    {/* 背景（全幅） */}
    <div
  aria-hidden
  className="absolute inset-0"
  style={{
  backgroundImage: `
    /* 左の芯（濃いピンク） */
    radial-gradient(1200px 820px at 18% 54%, rgba(255,59,122,0.58), transparent 62%),
    /* 中央のつなぎ（境界をぼかす） */
    radial-gradient(900px 760px at 52% 52%, rgba(255,140,175,0.22), transparent 70%),
    /* 右のふわ白 */
    radial-gradient(1100px 780px at 82% 38%, rgba(255,255,255,0.78), transparent 58%),
    /* 下側の艶 */
    radial-gradient(1000px 720px at 62% 92%, rgba(255,59,122,0.20), transparent 62%),
    /* ベース */
    linear-gradient(90deg,
      rgba(255,64,120,0.96) 0%,
      rgba(255,112,156,0.90) 34%,
      rgba(255,235,244,0.92) 66%,
      rgba(255,255,255,0.92) 100%
    )
  `,
}}

/>

    {/* ✅ PC：右に人物（透過PNGで馴染ませる） */}
<div className="pointer-events-none absolute inset-y-0 right-0 hidden md:block w-[58%] z-0">
  {/* 画像ラッパー：transformはここでやる */}
  <div
    className="absolute inset-0 origin-bottom-right scale-[1.6] -translate-x-[0%] translate-y-[48%]"
    style={{
      // ✅ 左端をフェードして「境界線」を消す（カードにかかっても自然）
      WebkitMaskImage:
        "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 10%, rgba(0,0,0,1) 26%, rgba(0,0,0,1) 100%)",
      maskImage:
        "linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 10%, rgba(0,0,0,1) 26%, rgba(0,0,0,1) 100%)",
    }}
  >
    <Image
      src="/hero/meme1.png" // ←透過PNG
      alt="NAVIÉ イメージビジュアル"
      fill
      priority
      sizes="60vw"
      className="object-contain object-right-bottom"
    />
  </div>

  {/* ほんのり馴染ませる光（任意だけど効く） */}
  <div
    aria-hidden
    className="absolute inset-0"
    style={{
      background:
        "radial-gradient(900px 700px at 20% 55%, rgba(255,59,122,0.18) 0%, rgba(255,59,122,0) 62%)",
    }}
  />
</div>

    {/* 中身コンテナ（高さにフィットさせる） */}
    <div className="mx-auto max-w-7xl px-4 h-full">
      {/* ✅ PC版：カードは左固定（画像に被せない） */}
      <div className="hidden md:flex h-full items-center">
        <Reveal>
          <div className="relative z-10 w-full max-w-[800px] lg:max-w-[860px] md:-translate-x-2 lg:-translate-x-4">
            <div className="rounded-[30px] bg-white/78 backdrop-blur-[10px] p-12 lg:p-14 border border-[rgba(255,255,255,0.55)] shadow-[0_18px_60px_rgba(18,18,24,0.10)]">
              <div
                className={[
                  "inline-flex items-center gap-2 rounded-full",
                  "border border-[rgba(255,59,122,0.22)]",
                  "bg-white/86 px-4 py-2",
                  "text-[12px] font-semibold whitespace-nowrap",
                  "shadow-[0_10px_30px_rgba(17,17,17,0.05)]",
                ].join(" ")}
                style={{ color: "var(--pink)" }}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--pink)" }} />
                押しつけない。でも放置しない。
              </div>

              <h1
  className="mt-6 md:mt-7 text-[36px] md:text-[44px] leading-[1.05] tracking-[-0.02em] text-[#0f0f12] font-black"
  style={{ fontFamily: "var(--font-display)" }}
>
  NAVIÉ
</h1>

              <div
                className="mt-4 h-[3px] w-[72%] rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(255,59,122,1) 0%, rgba(255,59,122,0.08) 100%)",
                }}
              />

              <p className="mt-6 text-[17px] leading-relaxed" style={{ color: "var(--muted)" }}>
                感覚ではなく「情報と経験」で、次の選択を導く。
                <br />
                あなたが <span className="font-bold text-[#0f0f12]">自分で納得して選べる状態</span> を静かに整えるナビゲーション。
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <NavieButton href="#cta">無料ではじめる</NavieButton>
                <NavieButton href="/chat" variant="secondary">
                  まずは相談する
                </NavieButton>
              </div>

              <p className="mt-3 text-[11px]" style={{ color: "rgba(95,96,107,0.9)" }}>
                ※ 無理な連絡・強引な提案はしません（相談だけでもOK）
              </p>
            </div>
          </div>
        </Reveal>
      </div>

      {/* ✅ スマホ版：写真 → カード（写真が上に来る） */}
      {/* ✅ スマホ版：Nomination寄せ（写真フルブリード＋下に重ね） */}
{/* ✅ スマホ版：Nomination寄せ（ミニマル） */}
<div className="md:hidden h-full relative -mx-4">
  {/* 背景写真（フルブリード） */}
  <Image
    src="/hero/mero.png"
    alt="NAVIÉ イメージビジュアル"
    fill
    priority
    sizes="100vw"
    className="object-cover object-[55%_22%]"
  />

  {/* 上白→下ピンク（文字の可読性） */}
  <div
  aria-hidden
  className="absolute inset-0"
  style={{
    background: `
      /* 上の白さを抑える（白飛び防止） */
      linear-gradient(180deg,
        rgba(255,255,255,0.55) 0%,
        rgba(255,255,255,0.10) 28%,
        rgba(255,59,122,0.12) 62%,
        rgba(255,59,122,0.55) 100%
      ),
      /* 端のピンクを強める（メリハリ） */
      radial-gradient(120% 90% at 50% 100%,
        rgba(255,59,122,0.90) 0%,
        rgba(255,59,122,0.22) 52%,
        rgba(255,59,122,0) 78%
      ),
      radial-gradient(90% 80% at 0% 55%,
        rgba(255,59,122,0.55) 0%,
        rgba(255,59,122,0) 62%
      ),
      radial-gradient(90% 80% at 100% 55%,
        rgba(255,167,196,0.40) 0%,
        rgba(255,167,196,0) 62%
      )
    `,
    /* ✅ 上を水平に“抜く”（顔〜肩の上はレイヤー無し） */
WebkitMaskImage:
  "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 46%, rgba(0,0,0,1) 72%, rgba(0,0,0,1) 100%)",
maskImage:
  "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 46%, rgba(0,0,0,1) 72%, rgba(0,0,0,1) 100%)",
  }}
/>

  {/* 下：コピー＋CTA（これだけ） */}
  <div className="absolute inset-x-0 bottom-4 px-4 pb-5">
    <div className="mx-auto max-w-[560px]">
      <div className="rounded-[28px] border border-white/55 bg-white/70 backdrop-blur-[12px] shadow-[0_18px_60px_rgba(18,18,24,0.12)]">
        <div className="p-5">

  {/* H1：少し小さく＋改行減らす */}
  <h1
  className="mt-6 md:mt-7 text-center text-[34px] md:text-[40px] leading-[1.05] tracking-[-0.02em] text-[#0f0f12] font-black"
  style={{ fontFamily: "var(--font-display)" }}
>
  NAVIÉ
</h1>

  <div
  className="mt-4 h-[3px] w-[68%] md:w-[56%] rounded-full mx-auto"
  style={{
    background:
      "linear-gradient(90deg, rgba(255,59,122,1) 0%, rgba(255,59,122,0.12) 60%, rgba(255,59,122,0.02) 100%)",
  }}
/>

  {/* リード：2行で止める */}
  <p className="mt-3 text-[12.5px] leading-relaxed" style={{ color: "rgba(95,96,107,0.92)" }}>
    「情報と経験」で、次の選択を静かに整える。
    <br />
    <span className="font-bold text-[#0f0f12]">納得して選べる状態</span>をつくるナビ。
  </p>

  {/* CTA：高さを落とす */}
  <div className="mt-4">
    <NavieButton href="#cta" className="w-full justify-center text-[13px] py-2.5 rounded-full">
      無料ではじめる
    </NavieButton>
  </div>

  <p className="mt-2 text-[10px]" style={{ color: "rgba(95,96,107,0.88)" }}>
    ※ 無理な連絡・強引な提案はありません
  </p>
</div>

      </div>
    </div>
  </div>
</div>
    </div>
  </div>
</SectionShell>

      {/* ✅ Service（blush） */}
      <Section
        id="service"
        kicker="SERVICE"
        title="NAVIÉができること"
        lead="“助ける”より、“一緒に選べる状態”をつくる。判断軸を整えて、迷いを減らします。"
        tone="blush"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Reveal delayMs={0}>
            <Card title="経験ベースの情報整理" body="表に出にくいリアルな情報を、判断しやすい形に整えます。" />
          </Reveal>
          <Reveal delayMs={80}>
            <Card title="状況に合わせた選択肢提示" body="未経験・経験者、それぞれに最適な視点で候補を整理します。" />
          </Reveal>
          <Reveal delayMs={160}>
            <Card title="チャットベースのナビ" body="一方通行じゃない。会話しながら、迷いの原因を分解します。" />
          </Reveal>
          <Reveal delayMs={240}>
            <Card title="中立スタンス" body="どこかに誘導しない。選ぶのは、あなた。" />
          </Reveal>
        </div>
      </Section>

      <SectionDivider />

      {/* ✅ Difference（white） */}
      <SectionShell id="difference" tone="white" className="py-16 md:py-24">
        <div className="mx-auto w-full max-w-6xl px-4">
          <p className="text-[12px] font-semibold tracking-[0.18em]" style={{ color: "var(--pink)" }}>
            DIFFERENCE
          </p>
          <h2 className="mt-2 text-2xl md:text-4xl font-semibold tracking-tight text-[#0f0f12]">
            支援ではなく、ナビ。
          </h2>

          <Reveal>
            <div className="mt-10 nomi-card overflow-hidden">
              <div className="grid grid-cols-3 text-[13px]">
                <div className="p-5 font-semibold" style={{ color: "var(--muted)" }}>
                  項目
                </div>
                <div
                  className="p-5 font-semibold border-l border-[rgba(15,15,18,0.10)]"
                  style={{ color: "var(--muted)" }}
                >
                  よくある
                </div>
                <div
                  className="p-5 font-semibold border-l border-[rgba(15,15,18,0.10)]"
                  style={{ background: "rgba(255,59,122,0.08)" }}
                >
                  NAVIÉ
                </div>

                {[
                  ["スタンス", "勧めが強い", "誘導しない / 整理する"],
                  ["進め方", "一方通行", "会話しながら分解"],
                  ["意思決定", "急かす", "納得まで待つ"],
                  ["目的", "決めさせる", "選べる状態を作る"],
                ].map(([a, b, c], i) => (
                  <Fragment key={`${a}-${i}`}>
                    <div className="p-5 border-t border-[rgba(15,15,18,0.10)] text-[#0f0f12]">{a}</div>
                    <div
                      className="p-5 border-t border-[rgba(15,15,18,0.10)] border-l border-[rgba(15,15,18,0.10)]"
                      style={{ color: "var(--muted)" }}
                    >
                      {b}
                    </div>
                    <div
                      className="p-5 border-t border-[rgba(15,15,18,0.10)] border-l border-[rgba(15,15,18,0.10)] font-semibold text-[#0f0f12]"
                      style={{ background: "rgba(255,59,122,0.08)" }}
                    >
                      {c}
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </SectionShell>

      <SectionDivider />

      {/* ✅ Safety（blush） */}
      <Section
        id="safety"
        kicker="SAFETY"
        title="安心・安全への取り組み"
        lead="不安が残ると、決断は鈍ります。安心して“選べる”ための前提を整えます。"
        tone="blush"
      >
        <div className="grid gap-5 md:grid-cols-3">
          <Reveal delayMs={0}>
            <Card tag="POLICY" title="強引な提案はしない" body="“やるべき”を押しつけず、判断材料を渡します。" />
          </Reveal>
          <Reveal delayMs={80}>
            <Card tag="POLICY" title="会話のペースはあなたに合わせる" body="急かさない。迷いが言語化できるまで待ちます。" />
          </Reveal>
          <Reveal delayMs={160}>
            <Card tag="POLICY" title="情報の扱いを慎重に" body="必要以上に聞かない。扱う情報は最小限から。" />
          </Reveal>
        </div>

        <Reveal delayMs={220}>
          <div className="mt-6 nomi-card p-6">
            <div className="grid gap-3 md:grid-cols-2 text-[13px]" style={{ color: "var(--muted)" }}>
              {[
                "相談だけでもOK（無理な連絡なし）",
                "迷いの原因を分解して“選べる状態”に",
                "気持ちに寄りすぎず、情報に寄せる",
                "納得できる選択だけを残す",
              ].map((t, i) => (
                <Reveal key={t} delayMs={i * 40}>
                  <div className="flex items-start gap-2">
                    <span className="mt-[7px] h-2 w-2 rounded-full" style={{ background: "var(--pink)" }} />
                    <span>{t}</span>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>
      </Section>

      <SectionDivider />

      {/* ✅ Flow（white） */}
      <Section
        id="flow"
        kicker="HOW TO"
        title="はじめ方は、シンプル。"
        lead="STEPで迷わせない。行動が一瞬で理解できる流れに。"
        tone="white"
      >
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { step: "1", title: "無料登録", body: "まずは最小限から。あとで整えられます。" },
            { step: "2", title: "簡単ヒアリング", body: "状況と迷いを短く整理します。" },
            { step: "3", title: "情報を整理", body: "選択肢と判断軸を見える化します。" },
            { step: "4", title: "自分で選ぶ", body: "納得できる選択だけを残します。" },
          ].map((x, i) => (
            <Reveal key={x.step} delayMs={i * 70}>
              <div className="nomi-card p-6">
                <div
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white font-bold"
                  style={{
                    background: "linear-gradient(135deg, #FF2F72 0%, #FF5B8D 60%, #FFD0DF 100%)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {x.step}
                </div>
                <p className="mt-3 text-[15px] font-semibold text-[#0f0f12]">{x.title}</p>
                <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
                  {x.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <SectionDivider />

      {/* ✅ FAQ（blush） */}
      <Section
        id="faq"
        kicker="FAQ"
        title="よくある質問"
        lead="短く・安心を先に出す。"
        tone="blush"
      >
        <div className="space-y-3">
          {[
            { q: "本当に相談だけでも大丈夫？", a: "大丈夫です。まずは状況整理から。無理に進めません。" },
            { q: "何を話せばいい？", a: "迷っている理由がぼんやりでもOK。こちらで分解していきます。" },
            { q: "登録は無料？", a: "無料で始められます（相談だけでもOK）。" },
          ].map((x, i) => (
            <Reveal key={x.q} delayMs={i * 60}>
              <details className="nomi-card group p-5">
                <summary className="cursor-pointer list-none text-[14px] font-semibold text-[#0f0f12]">
                  {x.q}
                  <span className="ml-2 inline-block transition group-open:rotate-45" style={{ color: "var(--pink)" }}>
                    ＋
                  </span>
                </summary>
                <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
                  {x.a}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* CTA（濃ピンク面なので tone不要） */}
      <section id="cta" className="scroll-mt-24 mx-auto max-w-6xl px-4 pb-20">
  <div className="ctaPinkSurface border border-[rgba(255,59,122,0.28)] shadow-[0_26px_90px_rgba(18,18,24,0.18)]">
    <div className="p-8 md:p-10">
      <Reveal>
        <div className="ctaPinkInner p-8 md:p-10 text-center">
  {/* ✅ 帯の中に“乗って見える”位置にする（-mt消す） */}
  <div className="relative z-10 pt-2">
    <p
      className="mx-auto inline-flex items-center gap-2 text-[12px] font-semibold tracking-[0.18em]"
      style={{ color: "var(--pink)" }}
    >
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--pink)" }} />
      GET STARTED
    </p>
  </div>

  <p className="mt-6 text-[22px] md:text-[28px] font-semibold tracking-tight text-[#0f0f12]">
    迷わないための、ナビがある。
  </p>

  {/* ✅ md以上は改行させない（スマホは自然に折り返し） */}
  <p
    className="mx-auto mt-3 text-[13px] md:text-sm leading-relaxed md:whitespace-nowrap"
    style={{ color: "var(--muted)" }}
  >
    まずは“今の状況”を短く整理するところから。相談だけでもOK。
  </p>

  {/* ✅ ボタン帯いらない → 普通に並べる */}
  <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
    <NavieButton href="/login" className="min-w-[220px] justify-center">
      無料ではじめる
    </NavieButton>
    <NavieButton href="/chat" variant="secondary" className="min-w-[220px] justify-center">
      まずは相談する
    </NavieButton>
  </div>

  <p className="mt-4 text-[11px]" style={{ color: "rgba(95,96,107,0.9)" }}>
    ※ 無理な連絡・強引な提案はありません
  </p>
</div>

      </Reveal>

      <footer className="mt-10 text-center text-[11px] text-white/85">
        © {new Date().getFullYear()} NAVIÉ
      </footer>
    </div>
  </div>
</section>

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "NAVIÉ",
            description: "迷わないための、ナビがある。",
            url: "https://example.com",
          }),
        }}
      />
    </main>
  );
}
