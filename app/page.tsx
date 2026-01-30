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
    <section id={id} className={`relative scroll-mt-24 ${className}`}>
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
            <p
              className="mt-4 text-sm md:text-base leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
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
      <p
        className="text-[11px] font-semibold tracking-[0.22em]"
        style={{ color: "var(--pink)" }}
      >
        {tag}
      </p>
      <p className="mt-2 text-[15px] font-semibold text-[#0f0f12]">{title}</p>
      <p
        className="mt-2 text-[13px] leading-relaxed"
        style={{ color: "var(--muted)" }}
      >
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
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: "var(--pink)" }}
                      />
                      夜のお仕事、ひとりで決めなくていい。
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

                    <p className="mt-6 max-w-[520px] text-[17px] leading-relaxed" style={{ color: "var(--muted)" }}>
  <span className="block">水商売・接客系・芸能系など、夜のお仕事の求人を</span>
  <span className="block">担当者とチャットで相談しながら探せます。</span>
  <span className="block">面接の日程調整まで一緒に。必要なら面接同行も可能です。</span>
</p>

                    <div className="mt-7 flex flex-wrap items-center gap-3">
  <NavieButton href="#cta">無料ではじめる</NavieButton>
</div>

                    <p
                      className="mt-3 text-[11px]"
                      style={{ color: "rgba(95,96,107,0.9)" }}
                    >
                      ※ 無理な連絡や、強引な勧誘はしません（相談だけでもOK）／面接同行はエリア・状況により対応可
                    </p>
                  </div>
                </div>
              </Reveal>
            </div>

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

                      <p
                        className="mt-3 text-[12.5px] leading-relaxed"
                        style={{ color: "rgba(95,96,107,0.92)" }}
                      >
                        水商売・接客系・芸能系など、夜のお仕事の求人を
                        <br />
                        担当者とチャットで相談しながら探せます。
                      </p>

                      <div className="mt-4">
                        <NavieButton
                          href="#cta"
                          className="w-full justify-center text-[13px] py-2.5 rounded-full"
                        >
                          無料ではじめる
                        </NavieButton>
                      </div>

                      <p
                        className="mt-2 text-[10px]"
                        style={{ color: "rgba(95,96,107,0.88)" }}
                      >
                        ※ 無理な連絡や、強引な勧誘はありません／面接同行はエリア・状況により
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /mobile */}
          </div>
        </div>
      </SectionShell>

      {/* ✅ Service（blush） */}
      <Section
        id="service"
        kicker="SERVICE"
        title="NAVIÉができること"
        lead="求人を見るだけじゃなくて、相談から日程調整まで。担当者と一緒に進められます。"
        tone="blush"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Reveal delayMs={0}>
            <Card
              title="担当者がついて、チャットで相談"
              body="不安なこと、条件のこと、言葉にしづらいことも。チャットで気軽に聞けます。"
            />
          </Reveal>
          <Reveal delayMs={80}>
            <Card
              title="面接・体験入店の予定を一緒に調整"
              body="お店との日程調整もサポート。やり取りが苦手でも、任せて大丈夫です。"
            />
          </Reveal>
          <Reveal delayMs={160}>
            <Card
              title="不安なら、面接同行も相談できます"
              body="初めてで緊張する時は、同行も検討できます（※エリア・状況により）。ひとりで不安な時に。"
            />
          </Reveal>
          <Reveal delayMs={240}>
            <Card
              title="スケジュール管理で、予定がごちゃつかない"
              body="面接・体験・出勤の予定をまとめて管理。空きも見ながら動けます。"
            />
          </Reveal>
        </div>
      </Section>

      <SectionDivider />

      {/* ✅ Difference（white） */}
      <SectionShell id="difference" tone="white" className="py-16 md:py-24">
        <div className="mx-auto w-full max-w-6xl px-4">
          <p
            className="text-[12px] font-semibold tracking-[0.18em]"
            style={{ color: "var(--pink)" }}
          >
            DIFFERENCE
          </p>
          <h2 className="mt-2 text-2xl md:text-4xl font-semibold tracking-tight text-[#0f0f12]">
            “求人サイト”だけで終わらない。
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
                  ["相談", "基本は自分で", "担当者にチャットで相談できる"],
                  ["日程調整", "自分でやり取り", "面接・体験入店まで一緒に調整"],
                  ["安心感", "一人で動く", "必要なら面接同行も相談できる※"],
                  ["管理", "予定が散らばる", "スケジュールでまとめて管理"],
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

          <p className="mt-3 text-[11px]" style={{ color: "rgba(95,96,107,0.9)" }}>
            ※ 面接同行はエリア・状況により対応可
          </p>
        </div>
      </SectionShell>

      <SectionDivider />

      {/* ✅ Safety（blush） */}
      <Section
        id="safety"
        kicker="SAFETY"
        title="安心して使えるように"
        lead="不安が残ったままだと、決めづらい。だから、無理なく進められる形にしています。"
        tone="blush"
      >
        <div className="grid gap-5 md:grid-cols-3">
          <Reveal delayMs={0}>
            <Card
              tag="POLICY"
              title="無理に勧めません"
              body="強引な勧誘や、しつこい連絡はしません。合わなければやめて大丈夫。"
            />
          </Reveal>
          <Reveal delayMs={80}>
            <Card
              tag="POLICY"
              title="あなたのペースで進めます"
              body="今すぐ決めなくてOK。気になることを聞いてからで大丈夫です。"
            />
          </Reveal>
          <Reveal delayMs={160}>
            <Card
              tag="POLICY"
              title="必要以上に聞きません"
              body="最初は最低限の情報だけ。話したくないことは無理に聞きません。"
            />
          </Reveal>
        </div>

        <Reveal delayMs={220}>
          <div className="mt-6 nomi-card p-6">
            <div className="grid gap-3 md:grid-cols-2 text-[13px]" style={{ color: "var(--muted)" }}>
              {[
                "相談だけでもOK（無理な連絡なし）",
                "面接・体験入店の調整もサポート",
                "不安なら面接同行も相談できる（※エリア・状況により）",
                "予定はスケジュールでまとめて管理",
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
        title="はじめ方はシンプル"
        lead="登録して、チャットで相談。あとは一緒に整理しながら進めます。"
        tone="white"
      >
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { step: "1", title: "無料登録", body: "まずは登録だけ。あとで整えられます。" },
            { step: "2", title: "チャットで相談", body: "条件や不安を、気軽に聞けます。" },
            { step: "3", title: "日程調整", body: "面接・体験入店の予定も一緒に組みます。" },
            { step: "4", title: "当日もサポート", body: "不安なら面接同行も相談OK（※エリア・状況により）。予定は管理できます。" },
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
        lead="よく聞かれるところを、先にまとめました。"
        tone="blush"
      >
        <div className="space-y-3">
          {[
            { q: "本当に相談だけでも大丈夫？", a: "大丈夫です。まずは話を聞いて、状況を整理するところからでOKです。" },
            { q: "どんな求人があるの？", a: "水商売・接客系・芸能系など、夜のお仕事の求人が中心です。条件に合わせて一緒に探せます。" },
            { q: "面接のやり取りが不安…", a: "日程調整もサポートします。不安な場合は面接同行も相談できます（※エリア・状況により）。" },
            {
              q: "身バレしない？",
              a: "応募すると決めるまでは、必要以上の個人情報をお店に出しません。公開プロフィールも最小限で使います。",
            },
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
                  まずは、相談からで大丈夫。
                </p>

                {/* ✅ md以上は改行させない（スマホは自然に折り返し） */}
                <p
                  className="mx-auto mt-3 text-[13px] md:text-sm leading-relaxed md:whitespace-nowrap"
                  style={{ color: "var(--muted)" }}
                >
                  担当者とチャットで話して、面接や体験入店の予定まで一緒に組めます。
                </p>

                {/* ✅ ボタン帯いらない → 普通に並べる */}
                <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
  <NavieButton href="/login" className="min-w-[220px] justify-center">
    無料ではじめる
  </NavieButton>
</div>


                <p className="mt-4 text-[11px]" style={{ color: "rgba(95,96,107,0.9)" }}>
                  ※ 無理な連絡や、強引な勧誘はありません／面接同行はエリア・状況により対応可
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
            description:
              "水商売・接客系・芸能系など、夜のお仕事の求人を担当者とチャットで相談しながら探せるサービス。",
            url: "https://example.com",
          }),
        }}
      />
    </main>
  );
}

