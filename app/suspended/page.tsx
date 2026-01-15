// app/suspended/page.tsx

export default function SuspendedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050007] text-white">
      <div className="rounded-2xl border border-red-400/40 bg-red-500/10 px-6 py-6 text-center space-y-3">
        <h1 className="text-lg font-bold text-red-300">
          アカウントが利用停止されています
        </h1>
        <p className="text-sm text-gray-200">
          利用規約違反、または運営判断により<br />
          現在このアカウントはご利用いただけません。
        </p>
      </div>
    </div>
  );
}
