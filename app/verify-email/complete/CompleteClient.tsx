//app/verify-email/complete/CompleteClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { applyActionCode } from "firebase/auth";
import { getAuthClient } from "@/lib/firebase";

export default function CompleteClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const [msg, setMsg] = useState("認証を確認しています…");
  const [busy, setBusy] = useState(true);

  const auth = useMemo(() => getAuthClient(), []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        if (!auth) throw new Error("Firebase Auth が初期化できてない（env or browser）");

        const mode = sp.get("mode");
        const oobCode = sp.get("oobCode");

        // ✅ ログイン不要で「認証だけ確定」
        if (mode === "verifyEmail" && oobCode) {
          setMsg("認証リンクを確認中…");
          await applyActionCode(auth, oobCode);
        }

        if (cancelled) return;

        // ここではDB作成とかはしない（ログイン前提になっちゃうから）
        setMsg("メール認証が完了しました ✅\nログイン画面へ移動します…");
        setBusy(false);

        const t = setTimeout(() => router.replace("/login"), 1200);
        return () => clearTimeout(t);
      } catch (e: any) {
        console.error(e);
        if (cancelled) return;
        setMsg(e?.message ?? "認証に失敗しました。もう一度お試しください。");
        setBusy(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [auth, sp, router]);

  return (
    <div className="min-h-screen bg-[#050007] text-white flex items-center justify-center px-4">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm whitespace-pre-wrap">
        {msg}
        {!busy ? (
          <div className="mt-4">
            <button
              onClick={() => router.replace("/login")}
              className="w-full rounded-xl bg-[#ff2f92] px-4 py-2 text-sm font-semibold text-white hover:bg-[#ff4a9f]"
            >
              ログインへ
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
