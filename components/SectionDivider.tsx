// components/SectionDivider.tsx

export default function SectionDivider() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <div
        className="h-px w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(17,17,20,0.10) 18%, rgba(255,111,152,0.14) 50%, rgba(17,17,20,0.10) 82%, transparent 100%)",
        }}
      />
    </div>
  );
}
