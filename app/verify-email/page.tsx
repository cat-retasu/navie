// app/verify-email/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAuthClient, getFunctionsClient } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import NavieBg from "@/components/NavieBg";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatCallableError(e: any) {
  const code = e?.code ?? e?.name ?? "unknown";
  const message = e?.message ?? String(e);
  const details =
    e?.details == null
      ? ""
      : typeof e.details === "string"
      ? e.details
      : JSON.stringify(e.details);

  // ありがちな制限系は優しく出す
  if (
    code === "functions/resource-exhausted" ||
    code === "resource-exhausted" ||
    code === "too-many-requests"
  ) {
    return "再送が多すぎるみたい。10〜30分くらい空けてからもう一回試してね。";
  }

  return `再送に失敗しました。\ncode: ${code}\nmessage: ${message}${details ? `\ndetails: ${details}` : ""}`;
}

export default function VerifyEmailSentPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // ✅ client-only
  const auth = useMemo(() => getAuthClient(), []);
  const functions = useMemo(() => getFunctionsClient("asia-northeast1"), []);

  useEffect(() => {
    setEmail(auth?.currentUser?.email ?? "");
  }, [auth]);

  const resend = async () => {
    const u = auth?.currentUser;
    if (!u) {
      setMsg("ログイン情報が見つかりません。いったんログインし直してね。");
      return;
    }
    if (!functions) {
      setMsg("通信の初期化に失敗しました。ページを再読み込みしてね。");
      return;
    }

    setBusy(true);
    setMsg("");
    try {
      const fn = httpsCallable(functions, "sendVerificationEmail");
      await fn({});
      setMsg("認証メールを再送しました。受信箱（迷惑メールも）を確認してね。");
    } catch (e: any) {
      console.error("sendVerificationEmail error:", e);
      setMsg(formatCallableError(e));
    } finally {
      setBusy(false);
    }
  };

  const goComplete = () => router.push("/verify-email/complete");

  const doLogout = async () => {
    if (!auth) {
      router.replace("/login");
      return;
    }
    setBusy(true);
    try {
      await signOut(auth);
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen text-[#0f0f12] relative overflow-hidden">
      {/* dashboard と同じ背景 */}
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
              background:
                "radial-gradient(900px 420px at 20% 10%, rgba(255,255,255,0.55), transparent 60%)",
            }}
          />

          <div className="relative">
            {/* Header（dashboardに寄せ） */}
            <header className="mb-6">
              <div className="flex items-center justify-between gap-3">
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

                <button
                  type="button"
                  onClick={doLogout}
                  disabled={busy}
                  className="rounded-full border border-black/10 bg-white/70 px-4 py-2 text-[12px] font-semibold hover:bg-white transition disabled:opacity-60"
                  style={{ color: "var(--muted)" }}
                >
                  ログアウト
                </button>
              </div>

              <p className="mt-5 text-[11px] font-semibold tracking-[0.18em]" style={{ color: "var(--pink)" }}>
                VERIFY EMAIL
              </p>
              <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-[#0f0f12]">
                認証メールを送信しました
              </h1>
              <p className="mt-2 text-xs md:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                メール内のリンクを開いて認証を完了してください。届かない場合は再送できます。
              </p>
            </header>

            {/* Card */}
            <section className="mx-auto w-full max-w-md nomi-card p-6 md:p-7">
              <p className="text-[11px] font-semibold tracking-[0.14em]" style={{ color: "var(--pink)" }}>
                SENT TO
              </p>

              <div className="mt-2 rounded-2xl border border-black/10 bg-white/70 px-4 py-3">
                <p className="text-[12px] font-semibold text-[#0f0f12]">
                  {email || "登録メールアドレス"}
                </p>
                <p className="mt-1 text-[11px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                  迷惑メール・プロモーションも確認してね
                </p>
              </div>

              {msg ? (
                <p className="mt-4 text-[12px] whitespace-pre-wrap leading-relaxed">
                  <span
                    className={cx(
                      "inline-block rounded-2xl border px-4 py-3 w-full",
                      msg.includes("再送しました")
                        ? "border-[rgba(255,59,122,0.20)] bg-[rgba(255,59,122,0.06)]"
                        : "border-black/10 bg-white/70"
                    )}
                    style={{ color: msg.includes("再送しました") ? "var(--pink)" : "rgba(95,96,107,0.95)" }}
                  >
                    {msg}
                  </span>
                </p>
              ) : null}

              <div className="mt-5 grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={resend}
                  disabled={busy}
                  className={cx(
                    "w-full rounded-full border border-black/10 bg-white/70 px-5 py-3 text-[13px] font-semibold",
                    "hover:bg-white transition disabled:opacity-60"
                  )}
                  style={{ color: "var(--muted)" }}
                >
                  {busy ? "送信中…" : "認証メールを再送する"}
                </button>

                <button
                  type="button"
                  onClick={goComplete}
                  disabled={busy}
                  className={cx(
                    "w-full rounded-full border border-[rgba(255,59,122,0.28)] bg-[rgba(255,59,122,0.10)] px-5 py-3 text-[13px] font-semibold",
                    "hover:bg-[rgba(255,59,122,0.14)] transition disabled:opacity-60"
                  )}
                  style={{ color: "var(--pink)" }}
                >
                  認証完了ページへ
                </button>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={doLogout}
                  disabled={busy}
                  className="w-full rounded-2xl border border-black/10 bg-white/60 px-4 py-3 text-[11px] font-semibold hover:bg-white transition disabled:opacity-60"
                  style={{ color: "rgba(95,96,107,0.90)" }}
                >
                  別のメールで登録する（ログアウト）
                </button>
              </div>

              <p className="mt-4 text-[10px] leading-relaxed" style={{ color: "rgba(95,96,107,0.80)" }}>
                ヒント：Gmailなら「すべてのメール」、iCloudなら「迷惑メール」も見てみて。
              </p>
            </section>

            {/* Bottom note（dashboardのTIPS風） */}
            <section className="mt-6 nomi-card p-6 md:p-7 max-w-5xl">
              <p className="text-[11px] font-semibold tracking-[0.18em]" style={{ color: "var(--pink)" }}>
                TIPS
              </p>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
                認証リンクを開いたあと、画面を戻しても反映されないときは「認証完了ページへ」からチェックできます。
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
