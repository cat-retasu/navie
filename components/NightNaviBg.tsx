// components/NightNaviBg.tsx

import React from "react";

export function NightNaviBg({
  variant = "default",
}: {
  variant?: "default" | "soft" | "admin";
}) {
  // ページごとに “光の強さ/サイズ” だけ変えられるようにしておく
  const presets =
    variant === "admin"
      ? {
          left: "h-[220px] w-[220px] bg-[radial-gradient(circle_at_center,_rgba(236,72,153,0.18),_transparent_70%)] blur-[80px]",
          right:
            "h-[220px] w-[220px] bg-[radial-gradient(circle_at_center,_rgba(129,140,248,0.14),_transparent_70%)] blur-[90px]",
          bottom:
            "h-[260px] bg-[radial-gradient(circle_at_bottom,_rgba(236,72,153,0.10),_transparent_70%)] blur-[90px]",
        }
      : variant === "soft"
      ? {
          left: "h-[180px] w-[180px] bg-[radial-gradient(circle_at_center,_rgba(236,72,153,0.18),_transparent_70%)] blur-[70px]",
          right: "",
          bottom:
            "h-[220px] bg-[radial-gradient(circle_at_bottom,_rgba(129,140,248,0.14),_transparent_70%)] blur-[90px]",
        }
      : {
          left: "h-[220px] w-[220px] bg-[radial-gradient(circle_at_center,_rgba(236,72,153,0.22),_transparent_70%)] blur-[80px]",
          right: "",
          bottom:
            "h-[260px] bg-[radial-gradient(circle_at_bottom,_rgba(129,140,248,0.18),_transparent_70%)] blur-[90px]",
        };

  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-[#050007]" />
      <div className={`absolute -left-28 -top-16 rounded-full ${presets.left}`} />
      {presets.right ? (
        <div className={`absolute -right-24 top-24 rounded-full ${presets.right}`} />
      ) : null}
      <div className={`absolute inset-x-0 bottom-0 ${presets.bottom}`} />
    </div>
  );
}
