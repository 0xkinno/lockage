"use client";

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark } from "./Logo";
import { WalletButton } from "./WalletButton";

const ITEMS = [
  { href: "/survey", label: "Survey" },
  { href: "/cross", label: "Cross" },
  { href: "/keeper", label: "Keeper" },
  { href: "/census", label: "Census" },
  { href: "/proof", label: "Proof" },
  { href: "/judge", label: "Judges" },
];

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.dataset.theme === "dark"), []);
  return (
    <button
      className="grid place-items-center w-9 h-9 rounded-full border border-hairline bg-paper-2 hover:shadow-[var(--lime-glow)] transition"
      aria-label={dark ? "Switch to light paper" : "Switch to dark ink"}
      onClick={() => {
        const next = dark ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("lockage-theme", next);
        } catch {}
        setDark(!dark);
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        {dark ? (
          <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        ) : (
          <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  );
}

export function Nav() {
  const path = usePathname();
  const reduce = useReducedMotion();
  const [sheet, setSheet] = useState(false);
  useEffect(() => setSheet(false), [path]);
  useEffect(() => {
    document.body.style.overflow = sheet ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheet]);

  const isActive = (href: string) => path === href || path.startsWith(href + "/");

  return (
    <>
      <header className="no-print fixed top-3 md:top-4 inset-x-0 z-50 pointer-events-none">
        <div className="wrap">
          <div className="grid grid-cols-[1fr_auto] lg:grid-cols-[1fr_auto_1fr] items-center gap-3">
            <Link href="/" className="pointer-events-auto justify-self-start rounded-full bg-[var(--nav-bg)] backdrop-blur-xl border border-hairline px-4 h-11 inline-flex items-center" aria-label="LOCKAGE home">
              <Wordmark />
            </Link>

            <LayoutGroup id="nav">
              <nav aria-label="Primary" className="pointer-events-auto hidden lg:flex items-center gap-1 rounded-full bg-[var(--nav-bg)] backdrop-blur-xl border border-hairline p-1.5" data-testid="nav-capsule">
                {ITEMS.map((it) => {
                  const active = isActive(it.href);
                  return (
                    <Link key={it.href} href={it.href} className="relative px-4 h-9 inline-flex items-center text-[14px] font-medium" aria-current={active ? "page" : undefined} data-active={active ? "true" : "false"}>
                      {active && (
                        <motion.span
                          layoutId="nav-glow"
                          data-testid="nav-active-glow"
                          className="absolute inset-0 rounded-[8px] bg-lime"
                          style={{ boxShadow: "var(--lime-glow)" }}
                          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                        />
                      )}
                      <span className="relative z-10" style={{ color: active ? "#12140c" : "var(--ink-2)" }}>
                        {it.label}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </LayoutGroup>

            <div className="pointer-events-auto justify-self-end flex items-center gap-2 rounded-full bg-[var(--nav-bg)] backdrop-blur-xl border border-hairline p-1.5 pl-2">
              <span className="hidden lg:block">
                <ThemeToggle />
              </span>
              <WalletButton />
              <button className="lg:hidden grid place-items-center w-9 h-9 rounded-full border border-hairline bg-paper-2" aria-label="Open menu" aria-expanded={sheet} onClick={() => setSheet(true)} data-testid="menu-button">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 8h16M4 16h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {sheet && (
        <div className="fixed inset-0 z-[70] bg-paper flex flex-col" role="dialog" aria-modal="true" aria-label="Menu" data-testid="menu-sheet">
          <div className="wrap flex items-center justify-between pt-3 h-[68px]">
            <Wordmark />
            <button className="btn btn-ring btn-sm" onClick={() => setSheet(false)}>
              Close
            </button>
          </div>
          <LayoutGroup id="sheet">
            <nav className="wrap mt-6 grid gap-2" aria-label="Mobile">
              {[{ href: "/", label: "Home" }, ...ITEMS].map((it) => {
                const active = it.href === "/" ? path === "/" : isActive(it.href);
                return (
                  <Link key={it.href} href={it.href} className="relative rounded-[12px] px-5 py-4 display text-[34px]" data-active={active ? "true" : "false"}>
                    {active && <span className="absolute inset-0 rounded-[12px] bg-lime" style={{ boxShadow: "var(--lime-glow)" }} />}
                    <span className="relative z-10" style={{ color: active ? "#12140c" : "var(--ink)" }}>
                      {it.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </LayoutGroup>
          <div className="wrap mt-auto pb-8 flex items-center justify-between">
            <span className="label">Testnet only</span>
            <ThemeToggle />
          </div>
        </div>
      )}
    </>
  );
}
