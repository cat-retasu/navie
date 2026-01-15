// components/ScrollSpyHeader.tsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import NavieButton from "@/components/NavieButton";

type LinkItem = { id: string; label: string };

export default function ScrollSpyHeader() {
  const links: LinkItem[] = useMemo(
    () => [
      { id: "service", label: "サービス" },
      { id: "difference", label: "違い" },
      { id: "safety", label: "安心・安全" },
      { id: "flow", label: "使い方" },
      { id: "faq", label: "FAQ" },
      { id: "cta", label: "開始" },
    ],
    []
  );

  // ✅ スマホ下段チップはCTAを除外（「無料ボタン」と役割分離）
  const chipLinks = useMemo(() => links.filter((l) => l.id !== "cta"), [links]);

  const [active, setActive] = useState<string>(links[0]!.id);
  const barRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const headerOffset = 110;
    const sections = links
      .map((l) => document.getElementById(l.id))
      .filter(Boolean) as HTMLElement[];

    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight || 1;
      const p = Math.min(1, Math.max(0, doc.scrollTop / max));
      if (barRef.current) barRef.current.style.width = `${p * 100}%`;

      let currentId = links[0]!.id;
      for (const el of sections) {
        const top = el.getBoundingClientRect().top;
        if (top <= headerOffset) currentId = el.id;
        else break;
      }
      setActive((prev) => (prev === currentId ? prev : currentId));
      rafRef.current = null;
    };

    const onScroll = () => {
      if (rafRef.current != null) return;
      rafRef.current = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [links]);

  const goTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(15,15,18,0.10)] bg-white/92 backdrop-blur-xl">
      {/* progress bar */}
      <div className="h-[2px] w-full bg-transparent">
        <div
          ref={barRef}
          className="h-full"
          style={{
            width: "0%",
            background: "linear-gradient(90deg, #FF2F72 0%, #FF5B8D 55%, #FFD0DF 100%)",
          }}
        />
      </div>

      {/* Top row */}
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Brand */}
        <a href="#top" className="flex items-center gap-3 shrink-0">
          <div className="h-9 w-9 rounded-[14px] bg-white border border-[rgba(255,59,122,0.22)] grid place-items-center shadow-[0_10px_30px_rgba(17,17,17,0.06)]">
            <span className="text-[12px] font-semibold" style={{ color: "rgba(255,59,122,1)" }}>
              N
            </span>
          </div>
          <div className="font-semibold tracking-wide">
            NAVI<span className="align-super text-[11px] ml-[1px]">É</span>
          </div>
        </a>

        {/* ✅ Desktop/Tablet nav (sm以上で復活) */}
        <nav className="hidden sm:flex items-center gap-2 text-sm min-w-0">
          {links.map((l) => {
            const isActive = active === l.id;
            return (
              <a
                key={l.id}
                href={`#${l.id}`}
                className={[
                  "nomi-pill-hover px-4 py-2 rounded-full border",
                  isActive
                    ? "text-[#0f0f12] bg-white border-[rgba(255,59,122,0.35)] shadow-[0_10px_26px_rgba(18,18,24,0.08)]"
                    : "text-[rgba(95,96,107,1)] border-transparent hover:text-[#0f0f12] hover:bg-white/70",
                ].join(" ")}
              >
                {l.label}
              </a>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* ✅ Mobile: CTAは1個だけ（開始/目次ボタンは置かない） */}
          <NavieButton
            href="#cta"
            className="sm:hidden h-[40px] px-4 text-[12px] whitespace-nowrap"
          >
            無料ではじめる
          </NavieButton>

          {/* ✅ Desktop/Tablet: 相談する + 無料ではじめる（従来通り） */}
          <div className="hidden sm:flex items-center gap-3">
            <NavieButton href="/chat" variant="secondary">
              相談する
            </NavieButton>
            <NavieButton href="#cta">無料ではじめる</NavieButton>
          </div>
        </div>
      </div>

      {/* ✅ Mobile: 下段チップ（これが“目次”の代わり。ボタンの「目次」は不要） */}
      <div className="sm:hidden px-4 pb-3">
        <div className="relative">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-6"
            style={{
              background: "linear-gradient(90deg, rgba(255,255,255,0.92), rgba(255,255,255,0))",
            }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-6"
            style={{
              background: "linear-gradient(270deg, rgba(255,255,255,0.92), rgba(255,255,255,0))",
            }}
          />

          <div className="flex gap-2 overflow-x-auto [-webkit-overflow-scrolling:touch] pr-2">
            {chipLinks.map((l) => {
              const isActive = active === l.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => goTo(l.id)}
                  className={[
                    "shrink-0 nomi-pill-hover rounded-full border font-semibold",
                    "px-3 py-2 text-[12px] whitespace-nowrap",
                    isActive
                      ? "text-[#0f0f12] bg-white border-[rgba(255,59,122,0.35)] shadow-[0_10px_22px_rgba(18,18,24,0.07)]"
                      : "text-[rgba(95,96,107,1)] bg-white/70 border-[rgba(15,15,18,0.06)]",
                  ].join(" ")}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
