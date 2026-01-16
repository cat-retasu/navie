// app/verify-email/complete/page.tsx
import { Suspense } from "react";
import CompleteClient from "./CompleteClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-white bg-[#050007]">
          読み込み中…
        </div>
      }
    >
      <CompleteClient />
    </Suspense>
  );
}
