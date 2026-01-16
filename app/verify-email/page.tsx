// app/verify-email/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getAuthClient, getFunctionsClient } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { httpsCallable } from "firebase/functions";

export default function VerifyEmailSentPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // ✅ クライアントでだけ有効な Firebase
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
      // nickname を送りたいならここで付けられる
      await fn({});

      setMsg("認証メールを再送しました。受信箱（迷惑メールも）を確認してね。");
    } catch (e: any) {
      setMsg(e?.message ?? "再送に失敗しました。少し待ってから試してね。");
    } finally {
      setBusy(false);
    }
  };

  const goComplete = () => {
    router.push("/verify-email/complete");
  };

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
    <div className="min-h-screen bg-[#050007] text-white px-5 py-10">
      <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h1 className="text-lg font-bold">認証メールを送信しました</h1>

        <p className="mt-2 text-sm text-gray-300">
          {email ? (
            <>
              <span className="text-gray-200">{email}</span> に認証リンクを送りました。
            </>
          ) : (
            <>登録メールに認証リンクを送りました。</>
          )}
          <br />
          メール内のリンクを開いて認証を完了してください。
        </p>

        {msg ? (
          <p className="mt-3 text-xs text-pink-200 whitespace-pre-wrap">{msg}</p>
        ) : null}

        <div className="mt-6 flex gap-2">
          <button
            onClick={resend}
            disabled={busy}
            className="flex-1 rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2 text-sm hover:bg-white/[0.07] disabled:opacity-60"
          >
            再送する
          </button>

          <button
            onClick={goComplete}
            disabled={busy}
            className="flex-1 rounded-xl border border-pink-400/30 bg-pink-500/10 px-4 py-2 text-sm hover:bg-pink-500/15 disabled:opacity-60"
          >
            認証完了ページへ
          </button>
        </div>

        <div className="mt-4">
          <button
            onClick={doLogout}
            disabled={busy}
            className="w-full rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2 text-xs text-gray-300 hover:bg-white/[0.05] disabled:opacity-60"
          >
            別のメールで登録する（ログアウト）
          </button>
        </div>
      </div>
    </div>
  );
}
