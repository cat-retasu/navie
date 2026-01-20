// app/pending/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import NavieBg from "@/components/NavieBg";
import NavieButton from "@/components/NavieButton";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function PendingPage() {
  const router = useRouter();
  const { user, userData, loading, logout } = useAuth();

  // ログイン / ロールチェック
  useEffect(() => {
    if (loading) return;

    // 未ログイン → ログインへ
    if (!user) {
      router.replace("/login");
      return;
    }

    // 既に承認済みならダッシュボード or 管理画面へ
    if (userData?.role && userData.role !== "pending") {
      if (userData.role === "admin") router.replace("/admin");
      else router.replace("/dashboard");
    }
  }, [user, userData, loading, router]);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  if (loading) {
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
      {/* 背景（LP/Loginと同じ世界観） */}
      <NavieBg />
      <div aria-hidden className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(1200px 720px at 18% 12%, rgba(255,59,122,0.16), transparent 62%),
              radial-gradient(900px 640px at 85% 26%, rgba(255,208,223,0.50), transparent 62%),
              radial-gradient(1000px 760px at 50% 110%, rgba(255,59,122,0.10), transparent 62%),
              linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,249,251,1) 48%, rgba(255,255,255,1) 100%)
            `,
          }}
        />
        <div className="pointer-events-none absolute inset-0 nomi-dots" />
        <div className="pointer-events-none absolute inset-0 navie-grain" />
      </div>

      <div className="mx-auto w-full px-4 pb-10 pt-16 md:pt-20">
        {/* ✅ md以上だけ外枠（スマホは枠なし） */}
        <div
          className={cx(
            "mx-auto w-full max-w-md",
            "md:max-w-[980px]",
            "md:rounded-[44px] md:border md:border-[rgba(255,59,122,0.18)]",
            "md:bg-white/55 md:backdrop-blur-[14px]",
            "md:shadow-[0_26px_90px_rgba(18,18,24,0.14)]",
            "md:p-6 lg:p-8",
            "md:relative md:overflow-hidden"
          )}
        >
          {/* PC枠の上品なハイライト（md以上） */}
          <div
            aria-hidden
            className="hidden md:block absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(900px 420px at 20% 10%, rgba(255,255,255,0.55), transparent 60%)",
            }}
          />

          <div className="relative mx-auto w-full max-w-3xl">
            {/* ヘッダー */}
            <header className="mb-6 md:mb-8">
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
              </div>

              <p className="mt-5 text-[11px] font-semibold tracking-[0.18em]" style={{ color: "var(--pink)" }}>
                REVIEW STATUS
              </p>

              <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-[#0f0f12]">
                プロフィール審査中です
              </h1>

              <p className="mt-2 text-xs md:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                運営が、入力いただいたプロフィール内容を確認しています。通常は
                <span className="font-semibold" style={{ color: "var(--pink)" }}>
                  {" "}
                  1時間以内{" "}
                </span>
                にご連絡しますので、もう少しだけお待ちください。
              </p>
            </header>

            {/* メイン */}
            <section className="nomi-card p-6 md:p-8 space-y-6">
              {/* ステータス */}
              <div className="flex items-start gap-3">
                <div className="mt-1 relative">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{
                      background: "var(--pink)",
                      boxShadow: "0 0 0 6px rgba(255,59,122,0.22)",
                    }}
                  />
                  <div
                    className="absolute inset-0 rounded-full animate-ping"
                    style={{ background: "rgba(255,59,122,0.22)" }}
                  />
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                    現在のステータス
                  </p>
                  <p className="mt-1 text-sm md:text-base font-semibold text-[#0f0f12]">
                    審査中（運営が内容を確認しています）
                  </p>
                </div>
              </div>

              {/* 審査中にできること */}
              <div className="rounded-[22px] border border-black/10 bg-white/75 backdrop-blur-[10px] p-5">
                <p className="text-[11px] font-semibold tracking-[0.12em]" style={{ color: "var(--muted)" }}>
                  審査中にできること
                </p>

                <ul className="mt-3 space-y-2 text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>
                  <li className="flex gap-2">
                    <span className="mt-0.5" style={{ color: "var(--pink)" }}>
                      ・
                    </span>
                    <span>
                      「いつ・どのエリアで・どれくらい稼ぎたいか」をメモしておくと、相談がスムーズです。
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-0.5" style={{ color: "var(--pink)" }}>
                      ・
                    </span>
                    <span>
                      不安なこと・気になる点があれば、審査完了後にスタッフが一緒に整理します。
                    </span>
                  </li>
                </ul>
              </div>

              {/* ボタン */}
              <div className="pt-1 flex flex-col sm:flex-row gap-3">
  <button
    type="button"
    onClick={handleLogout}
    className="w-full sm:w-auto inline-flex items-center justify-center rounded-full h-[52px] px-7 text-[14px] font-semibold transition
               border border-[rgba(255,59,122,0.46)] bg-white/90
               shadow-[0_10px_30px_rgba(17,17,17,0.07)]
               hover:bg-white hover:-translate-y-[1px] active:translate-y-0"
    style={{ color: "rgba(255,59,122,1)" }}
  >
    ログアウト
  </button>
</div>

              <p className="text-[10px] leading-relaxed" style={{ color: "rgba(95,96,107,0.85)" }}>
                ※ 審査状況について気になることがあれば、いつでもチャットでメッセージを送ってください。
              </p>
            </section>

            <p className="mt-4 text-center text-[10px]" style={{ color: "rgba(95,96,107,0.75)" }}>
              © {new Date().getFullYear()} NAVIÉ
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
