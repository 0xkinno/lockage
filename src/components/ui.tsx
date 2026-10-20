"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { addrUrl, txUrl } from "@/lib/chains";
import type { Verdict } from "@/lib/survey";

export function Reveal({ children, delay = 0, className = "", y = 16 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px" }}
      transition={{ duration: 0.4, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`label ${className}`}>{children}</div>;
}

export function Plate({ children, className = "", hover = true, as: As = "div" }: { children: ReactNode; className?: string; hover?: boolean; as?: "div" | "section" | "article" }) {
  return <As className={`plate ${hover ? "plate-hover" : ""} ${className}`}>{children}</As>;
}

export function VerdictChip({ v }: { v: Verdict }) {
  const label = v === "pass" ? "Passes" : v === "block" ? "Blocks graduation" : "Not determined";
  return (
    <span className={`chip chip-${v}`} data-verdict={v}>
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: 99, background: "currentColor", display: "inline-block" }} />
      {label}
    </span>
  );
}

export const short = (a?: string | null, n = 4) => (a ? `${a.slice(0, 2 + n)}…${a.slice(-n)}` : "");

export function Addr({ a, chain = "elysium", full = false }: { a: string; chain?: "elysium" | "hyperevm"; full?: boolean }) {
  return (
    <a className="mono underline decoration-hairline underline-offset-4 hover:decoration-ink" href={addrUrl(chain, a)} target="_blank" rel="noreferrer" title={a}>
      {full ? a : short(a)}
    </a>
  );
}

export function TxLink({ hash, chain = "elysium" }: { hash: string; chain?: "elysium" | "hyperevm" }) {
  return (
    <a className="mono underline decoration-hairline underline-offset-4 hover:decoration-ink" href={txUrl(chain, hash)} target="_blank" rel="noreferrer" title={hash} data-testid="tx-link">
      {short(hash, 6)}
    </a>
  );
}

export function SectionHead({ label, title, sub }: { label: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="max-w-3xl">
      <Label>{label}</Label>
      <h2 className="display mt-3 text-[40px] md:text-[56px]">{title}</h2>
      {sub ? <p className="mt-4 text-[17px] md:text-[19px] text-ink-2 max-w-2xl">{sub}</p> : null}
    </div>
  );
}

export function PageHead({ label, title, sub }: { label: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <header className="pt-32 md:pt-40 pb-8">
      <div className="wrap">
        <Label>{label}</Label>
        <h1 className="display mt-3 text-[44px] md:text-[72px] max-w-4xl">{title}</h1>
        {sub ? <p className="mt-5 text-[17px] md:text-[20px] text-ink-2 max-w-2xl">{sub}</p> : null}
      </div>
    </header>
  );
}

export function LinkBtn({ href, children, variant = "primary", ...rest }: { href: string; children: ReactNode; variant?: "primary" | "ring" } & Record<string, unknown>) {
  return (
    <Link href={href} className={`btn ${variant === "primary" ? "btn-primary" : "btn-ring"}`} {...rest}>
      {children}
    </Link>
  );
}

export function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Pending({ what, how }: { what: string; how: string }) {
  return (
    <div className="plate plate-flat" role="status">
      <div className="label">Pending a real run</div>
      <p className="mt-2 text-ink-2">
        {what} <span className="text-muted">{how}</span>
      </p>
    </div>
  );
}
