// app/verify-email/complete/CompleteClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function CompleteClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [msg, setMsg] = useState("確認中…");

  useEffect(() => {
    // 例：?status=ok とか ?error=... みたいなやつを拾う想定
    const status = searchParams.get("status");
    const error = searchParams.get("error");

    if (error) {
      setMsg("認証に失敗しました。もう一度お試しください。");
      return;
    }

    if (status === "ok") {
      setMsg("メール認証が完了しました ✅ ログイン画面へ移動します…");
      const t = setTimeout(() => router.replace("/login"), 1200);
      return () => clearTimeout(t);
    }

    // 何もない場合のフォールバック
    setMsg("メール認証が完了しました ✅");
    const t = setTimeout(() => router.replace("/login"), 1200);
    return () => clearTimeout(t);
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="rounded-2xl border border-black/10 bg-white/70 px-5 py-4 text-sm">
        {msg}
      </div>
    </div>
  );
}
