// app/login/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import NavieBg from "@/components/NavieBg";
import NavieButton from "@/components/NavieButton";

type Mode = "login" | "signup";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function normalizePhone(v: string) {
  return v.replace(/[^\d]/g, "");
}

function isOver18(birthDate: string) {
  if (!birthDate) return false;

  const today = new Date();
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return false;

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

  return age >= 18;
}

export default function LoginPage() {
  const router = useRouter();
  const { user, userData, loading, login, signup } = useAuth();

  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");

  const [phoneNumber, setPhoneNumber] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const avatarPreviewUrl = useMemo(() => {
    if (!avatarFile) return "";
    return URL.createObjectURL(avatarFile);
  }, [avatarFile]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!userData?.role) return;

    if (userData.role === "admin") {
      router.replace("/admin");
      return;
    }
    if (userData.role === "pending") {
      router.replace("/pending");
      return;
    }
    router.replace("/dashboard");
  }, [user, userData, loading, router]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
    };
  }, [avatarPreviewUrl]);

  const validate = () => {
    if (!email.trim()) return "メールアドレスを入力してね";
    if (!password) return "パスワードを入力してね";
    if (password.length < 6) return "パスワードは6文字以上にしてね";

    if (mode === "signup") {
      if (!nickname.trim()) return "ニックネームを入力してね";
      if (!birthDate) return "生年月日を入力してね";
      if (!isOver18(birthDate)) return "高校生・18歳未満の方は登録できません";

      const p = normalizePhone(phoneNumber);
      if (!p) return "電話番号を入力してね";
      if (p.length < 10 || p.length > 11)
        return "電話番号は10〜11桁（例：09012345678）で入力してね";

      if (!avatarFile) return "写真（アイコン）を選択してね";
    }

    return null;
  };

  const onSubmit = async () => {
    setError(null);
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        const p = normalizePhone(phoneNumber);
        await signup(
          email.trim(),
          password,
          { phoneNumber: p, nickname: nickname.trim(), birthDate },
          avatarFile
        );
      }
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg.includes("auth/invalid-email")) setError("メールアドレスの形式が違うかも");
      else if (msg.includes("auth/user-not-found")) setError("そのメールアドレスは登録されてないよ");
      else if (msg.includes("auth/wrong-password")) setError("パスワードが違うよ");
      else if (msg.includes("auth/email-already-in-use")) setError("そのメールアドレスは既に登録済みだよ");
      else setError("エラーが発生したよ。もう一度試してね");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
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
      {/* 背景（LPの世界観に寄せる） */}
      <NavieBg />
      <div aria-hidden className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              radial-gradient(1200px 720px at 20% 15%, rgba(255,59,122,0.16), transparent 62%),
              radial-gradient(900px 640px at 85% 30%, rgba(255,208,223,0.45), transparent 62%),
              radial-gradient(1000px 760px at 50% 110%, rgba(255,59,122,0.12), transparent 62%),
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
          {/* PC枠の上品なハイライト（md以上だけ） */}
          <div
            aria-hidden
            className="hidden md:block absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(900px 420px at 20% 10%, rgba(255,255,255,0.55), transparent 60%)",
            }}
          />

          {/* ✅ 中身 */}
          <div className="relative mx-auto w-full max-w-md">
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
              </div>

              <p
                className="mt-5 text-[11px] font-semibold tracking-[0.18em]"
                style={{ color: "var(--pink)" }}
              >
                {mode === "login" ? "LOGIN" : "SIGN UP"}
              </p>
              <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-[#0f0f12]">
                {mode === "login" ? "ログイン" : "新規登録"}
              </h1>
              <p className="mt-2 text-xs md:text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                {mode === "login"
                  ? "登録済みのメールアドレスでログインできます。"
                  : "ニックネーム・生年月日・電話番号・写真を追加して審査申請へ。"}
              </p>
            </header>

            {/* タブ */}
            {/* タブ（左右逆：左=新規登録 / 右=ログイン） */}
<div className="mb-4 rounded-[20px] border border-black/10 bg-white/70 backdrop-blur-[12px] p-1 shadow-[0_14px_50px_rgba(18,18,24,0.10)]">
  <div className="grid grid-cols-2 gap-2">
    {/* 左：新規登録 */}
    <button
      type="button"
      onClick={() => {
        setMode("signup");
        setError(null);
      }}
      className={cx(
        "rounded-[16px] px-3 py-2 text-[13px] font-semibold transition",
        mode === "signup"
          ? "bg-white shadow-[0_10px_26px_rgba(18,18,24,0.10)] border border-black/10"
          : "hover:bg-white/40"
      )}
      style={{ color: mode === "signup" ? "#0f0f12" : "var(--muted)" }}
    >
      新規登録
    </button>

    {/* 右：ログイン */}
    <button
      type="button"
      onClick={() => {
        setMode("login");
        setError(null);
      }}
      className={cx(
        "rounded-[16px] px-3 py-2 text-[13px] font-semibold transition",
        mode === "login"
          ? "bg-white shadow-[0_10px_26px_rgba(18,18,24,0.10)] border border-black/10"
          : "hover:bg-white/40"
      )}
      style={{ color: mode === "login" ? "#0f0f12" : "var(--muted)" }}
    >
      ログイン
    </button>
  </div>
</div>


            {/* メインカード */}
            <section className="nomi-card px-5 py-6 md:px-7 md:py-7 space-y-5">
              {error && (
                <div className="rounded-2xl border border-[rgba(255,59,122,0.25)] bg-[rgba(255,59,122,0.08)] px-4 py-3 text-xs">
                  <span className="font-semibold" style={{ color: "var(--pink)" }}>
                    エラー：
                  </span>{" "}
                  <span style={{ color: "var(--muted)" }}>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                  メールアドレス
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  placeholder="example@gmail.com"
                  className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-[#0f0f12] placeholder:text-[#9aa0aa] outline-none focus:border-[rgba(255,59,122,0.45)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                  パスワード
                </label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="6文字以上"
                  className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-[#0f0f12] placeholder:text-[#9aa0aa] outline-none focus:border-[rgba(255,59,122,0.45)]"
                />
              </div>

              {mode === "signup" && (
                <>
                  <div className="h-px w-full bg-black/10" />

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                      ニックネーム（必須）
                    </label>
                    <input
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="例：ゆな"
                      className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-[#0f0f12] placeholder:text-[#9aa0aa] outline-none focus:border-[rgba(255,59,122,0.45)]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                      生年月日（18歳以上）
                    </label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-[#0f0f12] outline-none focus:border-[rgba(255,59,122,0.45)]"
                    />
                    <p className="text-[10px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                      ※ 高校生・18歳未満の方は登録できません
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                      電話番号
                    </label>
                    <input
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="09012345678"
                      className="w-full rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-[#0f0f12] placeholder:text-[#9aa0aa] outline-none focus:border-[rgba(255,59,122,0.45)]"
                    />
                    <p className="text-[10px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                      ※ ハイフンなし推奨（例：09012345678）
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>
                      写真（アイコン）（必須）
                    </p>

                    <div className="flex items-center gap-3">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-black/10 bg-white/70">
                        {avatarPreviewUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={avatarPreviewUrl}
                            alt="avatar preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            className="h-full w-full flex items-center justify-center text-[10px]"
                            style={{ color: "rgba(95,96,107,0.75)" }}
                          >
                            未選択
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white/70 px-4 py-2 text-xs font-semibold hover:bg-white transition">
                          写真を選ぶ
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              setAvatarFile(f);
                            }}
                          />
                        </label>

                        {avatarFile && (
                          <button
                            type="button"
                            onClick={() => setAvatarFile(null)}
                            className="ml-2 text-xs font-semibold"
                            style={{ color: "var(--pink)" }}
                          >
                            解除
                          </button>
                        )}

                        <p className="mt-2 text-[10px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                          ※ 顔が分かりやすい写真がおすすめ（後から変更可）
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Submit */}
              <div className="pt-1">
                <NavieButton
                  href="#"
                  className={cx("w-full justify-center", submitting && "pointer-events-none opacity-70")}
                  onClick={(e) => {
                    e.preventDefault();
                    onSubmit();
                  }}
                >
                  {submitting
                    ? "送信中…"
                    : mode === "login"
                    ? "ログインする"
                    : "新規登録して審査申請"}
                </NavieButton>

                <p className="mt-3 text-[10px]" style={{ color: "rgba(95,96,107,0.85)" }}>
                  ※ 無理な連絡・強引な提案はありません
                </p>
              </div>

              {/* Links */}
              <div
                className="flex items-center justify-between text-[11px]"
                style={{ color: "rgba(95,96,107,0.95)" }}
              >
                <Link href="/" className="hover:opacity-80">
                  トップへ戻る
                </Link>
              </div>
            </section>

            <p className="mt-4 text-[10px] leading-relaxed" style={{ color: "rgba(95,96,107,0.85)" }}>
              続行すると、NAVIÉの利用規約・プライバシーポリシーに同意したものとみなします。
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}