// components/NavieBg.tsx

export default function NavieBg() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(180deg, #FFFFFF 0%, #FFF9FB 50%, #FFFFFF 100%),
            radial-gradient(520px 420px at 16% 18%, rgba(255,59,122,0.16), transparent 62%),
            radial-gradient(480px 380px at 86% 14%, rgba(255,111,152,0.12), transparent 64%),
            radial-gradient(760px 520px at 50% 74%, rgba(255,255,255,0.92), transparent 70%)
          `,
        }}
      />

      <div className="absolute inset-0 nomi-dots" />

      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(1100px 720px at 50% 34%, transparent 58%, rgba(14,14,20,0.09) 100%)",
        }}
      />
    </div>
  );
}
