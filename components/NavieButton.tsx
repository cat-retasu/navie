// components/NavieButton.tsx
import Link from "next/link";
import React from "react";

type Props = {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void; // ✅ 追加
};

export default function NavieButton({
  href,
  children,
  variant = "primary",
  className = "",
  onClick,
}: Props) {
  const base =
    "relative isolate overflow-hidden group inline-flex items-center justify-center gap-2 whitespace-nowrap " +
    "rounded-full h-[52px] px-7 text-[14px] font-semibold transition duration-200 " +
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(255,59,122,0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-white";

  const primary =
    "text-white shadow-[0_18px_50px_rgba(255,59,122,0.26)] hover:shadow-[0_22px_60px_rgba(255,59,122,0.32)] hover:-translate-y-[1px] active:translate-y-0";

  const secondary =
    "bg-white/90 text-[rgba(255,59,122,1)] border border-[rgba(255,59,122,0.46)] " +
    "shadow-[0_10px_30px_rgba(17,17,17,0.07)] hover:bg-white hover:-translate-y-[1px] active:translate-y-0";

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`${base} ${variant === "primary" ? primary : secondary} ${className}`.trim()}
    >
      {variant === "primary" && (
        <>
          <span
            aria-hidden
            className="absolute inset-0 z-0 rounded-full"
            style={{
              background: "linear-gradient(135deg, #FF2F72 0%, #FF5B8D 55%, #FF9DB8 100%)",
            }}
          />
          <span
            aria-hidden
            className="absolute inset-0 z-0 rounded-full opacity-0 transition duration-200 group-hover:opacity-100"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.00) 58%)",
            }}
          />
        </>
      )}
      <span className="relative z-10">{children}</span>
    </Link>
  );
}

