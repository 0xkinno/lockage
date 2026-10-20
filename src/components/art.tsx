"use client";

import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef, useState } from "react";

const STROKE = 1.5;

/* ------------------------------------------------------------------ hero plate */

/** Cutaway of four canal chambers climbing a hillside at dawn. Used until a photograph is supplied. */
export function HeroPlate() {
  return (
    <svg viewBox="0 0 520 640" className="w-full h-full" role="img" aria-label="Illustration: four canal lock chambers stepping up a hillside, a small vessel rising in the third chamber" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f7ec" />
          <stop offset="0.55" stopColor="#eaf2c0" />
          <stop offset="1" stopColor="#c8f04a" stopOpacity="0.55" />
        </linearGradient>
        <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#c8f04a" stopOpacity="0.95" />
          <stop offset="1" stopColor="#c8f04a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c8f04a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#7fa30a" stopOpacity="0.55" />
        </linearGradient>
        <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="7" stroke="#12140c" strokeOpacity="0.28" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="520" height="640" fill="url(#sky)" />
      <circle cx="402" cy="150" r="150" fill="url(#sun)" />
      <circle cx="402" cy="150" r="34" fill="#c8f04a" stroke="#12140c" strokeWidth={STROKE} />
      {/* contour lines of the hillside */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d={`M-10 ${520 - i * 46} C 120 ${500 - i * 52}, 260 ${430 - i * 50}, 540 ${380 - i * 54}`} stroke="#12140c" strokeOpacity={0.14 + i * 0.02} strokeWidth="1" fill="none" />
      ))}
      {/* chambers */}
      {[0, 1, 2, 3].map((i) => {
        const x = 18 + i * 118;
        const floor = 585 - i * 108;
        const w = 104;
        const top = floor - 118;
        const level = [64, 86, 104, 56][i];
        return (
          <g key={i}>
            <rect x={x - 8} y={top} width={w + 16} height={floor - top + 40} fill="url(#hatch)" stroke="#12140c" strokeWidth={STROKE} />
            <rect x={x} y={top} width={w} height={floor - top} fill="#f6f7ec" stroke="#12140c" strokeWidth={STROKE} />
            <rect x={x + 1} y={floor - level} width={w - 2} height={level - 1} fill="url(#water)" />
            <path d={`M${x + 1} ${floor - level} q 13 -5 26 0 t 26 0 t 26 0 t 25 0`} stroke="#12140c" strokeOpacity="0.45" strokeWidth="1" fill="none" />
            <rect x={x + w - 6} y={floor - 78} width="7" height="78" fill="#12140c" />
            <circle cx={x + w - 2.5} cy={floor - 60} r="2.2" fill="#c8f04a" />
          </g>
        );
      })}
      {/* vessel in the third chamber */}
      <g transform={`translate(${18 + 2 * 118 + 20} ${585 - 2 * 108 - 104 - 17})`}>
        <path d="M0 8 H62 L54 24 H8 Z" fill="#12140c" />
        <rect x="26" y="-6" width="14" height="14" fill="#f6f7ec" stroke="#12140c" strokeWidth={STROKE} />
        <path d="M33 -6 V-20 L47 -14 H33" fill="#c8f04a" stroke="#12140c" strokeWidth={STROKE} />
      </g>
      <g className="mono" fontSize="9.5" fill="#12140c" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
        {["LAUNCH", "ASCENDED", "HYPERCORE", "HIP-3"].map((t, i) => (
          <text key={t} x={22 + i * 118} y={585 - i * 108 + 28} opacity="0.85">
            {String(i + 1).padStart(2, "0")} {t}
          </text>
        ))}
      </g>
      <ellipse cx="170" cy="470" rx="150" ry="14" fill="#fff" opacity="0.35" />
      <ellipse cx="360" cy="330" rx="140" ry="12" fill="#fff" opacity="0.3" />
    </svg>
  );
}

/* ---------------------------------------------------------------------- ladder */

const RUNGS = [
  { name: "Launch", sub: "Token goes live on Elysium" },
  { name: "Ascended", sub: "Ascend status is earned" },
  { name: "HyperCore Spot", sub: "One-shot, permanent ceremony" },
  { name: "HIP-3 perps", sub: "A perp market for the ticker" },
];

function Water({ i, progress, floor, x, w }: { i: number; progress: MotionValue<number>; floor: number; x: number; w: number }) {
  const level = useTransform(progress, [i * 0.17, i * 0.17 + 0.3], [6, 118], { clamp: true });
  const y = useTransform(level, (l) => floor - l);
  return <motion.rect x={x + 1} y={y} width={w - 2} height={level} fill="url(#lw)" />;
}

function Vessel({ progress, floor, x }: { progress: MotionValue<number>; floor: number; x: number }) {
  const level = useTransform(progress, [0.34, 0.64], [6, 118], { clamp: true });
  const y = useTransform(level, (l) => floor - l - 20);
  return (
    <motion.g style={{ y }}>
      <g transform={`translate(${x + 40} 0)`}>
        <path d="M0 6 H62 L54 20 H8 Z" fill="var(--ink)" />
        <rect x="26" y="-6" width="14" height="12" fill="var(--paper)" stroke="var(--ink)" strokeWidth={STROKE} />
      </g>
    </motion.g>
  );
}

export function LadderDesktop() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 45%"] });
  const progress = useTransform(scrollYProgress, (v) => (reduce ? 1 : v));
  return (
    <div ref={ref} className="hidden md:block">
      <svg viewBox="0 0 1100 470" className="w-full h-auto" role="img" aria-label="The four-rung ladder: Launch, Ascended, HyperCore Spot, HIP-3. The third chamber carries a gate with five checks.">
        <defs>
          <linearGradient id="lw" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c8f04a" stopOpacity="0.95" />
            <stop offset="1" stopColor="#7fa30a" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        {RUNGS.map((r, i) => {
          const x = 30 + i * 268;
          const w = 220;
          const floor = 420 - i * 84;
          const top = floor - 150;
          return (
            <g key={r.name}>
              <rect x={x} y={top} width={w} height={floor - top} fill="var(--paper)" stroke="var(--ink)" strokeWidth={STROKE} rx="4" />
              <Water i={i} progress={progress} floor={floor} x={x} w={w} />
              {/* ground under chamber */}
              <path d={`M${x - 14} ${floor} H${x + w + 14}`} stroke="var(--ink)" strokeWidth={STROKE} />
              <path d={`M${x} ${floor} v24 M${x + w} ${floor} v24`} stroke="var(--ink)" strokeWidth={STROKE} />
              {/* gate */}
              {i < 3 && (
                <g>
                  <rect x={x + w - 4} y={floor - 92} width="9" height="92" fill="var(--ink)" rx="2" />
                  <circle cx={x + w + 0.5} cy={floor - 70} r="2.6" fill="var(--lime)" />
                </g>
              )}
              {i === 2 && (
                <g>
                  {/* five checks on the third chamber's gate approach */}
                  {[0, 1, 2, 3, 4].map((c) => (
                    <g key={c} transform={`translate(${x + 24 + c * 34} ${top + 16})`}>
                      <rect width="26" height="26" rx="6" fill="var(--lime)" stroke="var(--ink)" strokeWidth={STROKE} />
                      <path d="M7 13.5l4 4 8-9" stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  ))}
                  <text x={x + 24} y={top + 64} className="mono" fontSize="11" fill="var(--muted)" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
                    FIVE CHECKS
                  </text>
                </g>
              )}
              <text x={x} y={floor + 52} fontSize="11" fill="var(--muted)" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
                {String(i + 1).padStart(2, "0")}
              </text>
              <text x={x + 28} y={floor + 52} fontSize="20" fill="var(--ink)" style={{ fontFamily: "var(--font-sans)", fontWeight: 500, letterSpacing: "-0.02em" }}>
                {r.name}
              </text>
              <text x={x + 28} y={floor + 72} fontSize="13" fill="var(--ink-2)" style={{ fontFamily: "var(--font-sans)" }}>
                {r.sub}
              </text>
            </g>
          );
        })}
        <Vessel progress={progress} floor={420 - 2 * 84} x={30 + 2 * 268} />
      </svg>
    </div>
  );
}

export function LadderMobile() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });
  const [p, setP] = useState(reduce ? 1 : 0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setP(reduce ? 1 : v));
  return (
    <ol ref={ref} className="md:hidden grid gap-3" aria-label="The four-rung ladder">
      {RUNGS.map((r, i) => {
        const fill = Math.max(0.06, Math.min(1, (p - i * 0.17) / 0.3));
        return (
          <li key={r.name} className="relative overflow-hidden rounded-[16px] border border-hairline bg-paper px-4 py-4" style={{ marginLeft: i * 14 }}>
            <div className="absolute inset-y-0 left-0" style={{ width: `${fill * 100}%`, background: "linear-gradient(90deg, rgba(200,240,74,0.7), rgba(200,240,74,0.18))" }} aria-hidden />
            <div className="relative flex items-baseline gap-3">
              <span className="label">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <div className="font-medium text-[18px] tracking-[-0.02em]">{r.name}</div>
                <div className="text-[14px] text-ink-2">{r.sub}</div>
                {i === 2 && <div className="label mt-1.5">Five checks before this gate</div>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ----------------------------------------------------------- five check artifacts */

export type CheckKind = "supply" | "decimals" | "metadata" | "growth" | "transfer";

export function CheckArtifact({ kind }: { kind: CheckKind }) {
  const common = { fill: "none", stroke: "var(--ink)", strokeWidth: STROKE, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 200 120" className="h-full w-auto max-w-full" role="img" aria-label={`Artifact for ${kind}`}>
      {kind === "decimals" && (
        <g>
          {/* a ruler: decimals are granularity */}
          <rect x="14" y="40" width="172" height="40" rx="6" {...common} fill="var(--paper)" />
          {Array.from({ length: 23 }).map((_, i) => (
            <line key={i} x1={26 + i * 7} y1="40" x2={26 + i * 7} y2={i % 5 === 0 ? 62 : 52} {...common} />
          ))}
          <rect x="26" y="40" width="35" height="40" fill="var(--lime)" opacity="0.8" />
          <text x="26" y="98" fontSize="10" fill="var(--muted)" style={{ fontFamily: "var(--font-mono)" }}>
            wei 5 ... 8
          </text>
        </g>
      )}
      {kind === "supply" && (
        <g>
          {/* a vessel at the waterline: supply must clear the ceiling */}
          <path d="M20 54 h160" {...common} strokeDasharray="4 5" />
          <text x="22" y="46" fontSize="10" fill="var(--muted)" style={{ fontFamily: "var(--font-mono)" }}>
            2^64
          </text>
          <rect x="14" y="62" width="172" height="44" rx="4" fill="var(--lime)" opacity="0.55" />
          <path d="M14 62 q11 -5 22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0 t22 0" {...common} />
          <path d="M70 52 H128 L120 70 H78 Z" fill="var(--ink)" />
          <rect x="94" y="38" width="12" height="14" {...common} fill="var(--paper)" />
        </g>
      )}
      {kind === "metadata" && (
        <g>
          {/* a nameplate with a key: the name is the key to the mirror */}
          <rect x="22" y="30" width="116" height="40" rx="6" {...common} fill="var(--paper)" />
          <text x="34" y="56" fontSize="18" fill="var(--ink)" style={{ fontFamily: "var(--font-display)" }}>
            LDRIFT
          </text>
          <circle cx="40" cy="92" r="9" {...common} fill="var(--lime)" />
          <path d="M49 92 H122 M104 92 v10 M114 92 v7" {...common} />
          <path d="M150 36 l28 28 M178 36 l-28 28" stroke="var(--signal-red)" strokeWidth="1.8" strokeLinecap="round" opacity="0.0" />
        </g>
      )}
      {kind === "growth" && (
        <g>
          {/* a tap over a bucket: mint is an open tap */}
          <path d="M30 40 H96 q16 0 16 16 v6" {...common} />
          <rect x="84" y="28" width="26" height="12" rx="3" {...common} fill="var(--paper)" />
          <path d="M97 62 v14" stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="2 4" />
          <path d="M70 84 h56 l-6 24 h-44 Z" {...common} fill="var(--lime)" opacity="0.65" />
          <circle cx="97" cy="82" r="3" fill="var(--ink)" />
        </g>
      )}
      {kind === "transfer" && (
        <g>
          {/* scales: what arrives must equal what was sent */}
          <path d="M100 26 v66 M70 92 h60" {...common} />
          <path d="M44 42 h112" {...common} />
          <path d="M44 42 l-14 30 h28 Z M156 42 l-14 30 h28 Z" {...common} fill="var(--paper)" />
          <rect x="34" y="72" width="20" height="4" fill="var(--lime)" />
          <rect x="146" y="72" width="20" height="4" fill="var(--lime)" />
          <circle cx="100" cy="26" r="4" fill="var(--ink)" />
        </g>
      )}
    </svg>
  );
}

/* ---------------------------------------------------------------- the crossing */

/** A vessel passes two lock gates between Elysium and HyperEVM; the second gate closes red when the nameplate changes. */
export function CrossingScene() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(reduce ? 3 : 0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setPhase((p) => (p + 1) % 5), 2600);
    return () => clearInterval(t);
  }, [reduce]);
  const drifted = phase >= 3;
  const vesselX = phase === 0 ? 70 : phase === 1 ? 300 : phase === 2 ? 470 : phase === 3 ? 470 : 70;
  const name = drifted ? "LDRIFT2" : "LDRIFT";
  const cap = ["Sealed as LDRIFT. Vessel enters the first lock.", "Gate one opens: the route is registered.", "Vessel waits at the second gate: identity still matches.", "The owner renames the token. The nameplate no longer matches the seal.", "Refused before any funds move. Back to the first lock."][phase];
  return (
    <figure>
      <svg viewBox="0 0 900 300" className="w-full h-auto" role="img" aria-label="Animated illustration of a vessel crossing two lock gates; the second gate closes when the token name changes">
        <defs>
          <linearGradient id="cw" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c8f04a" stopOpacity="0.9" />
            <stop offset="1" stopColor="#7fa30a" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        {/* basins */}
        <rect x="20" y="120" width="270" height="130" fill="var(--paper)" stroke="var(--ink)" strokeWidth={STROKE} rx="4" />
        <rect x="21" y="150" width="268" height="99" fill="url(#cw)" />
        <rect x="320" y="90" width="250" height="160" fill="var(--paper)" stroke="var(--ink)" strokeWidth={STROKE} rx="4" />
        <rect x="321" y="140" width="248" height="109" fill="url(#cw)" />
        <rect x="600" y="60" width="280" height="190" fill="var(--paper)" stroke="var(--ink)" strokeWidth={STROKE} rx="4" />
        <rect x="601" y="130" width="278" height="119" fill="url(#cw)" />
        {/* gates */}
        <rect x="290" y="108" width="12" height="142" fill="var(--ink)" rx="2" />
        <motion.rect x="574" y="76" width="12" height="174" rx="2" animate={{ fill: drifted ? "#c8202f" : "#12140c" }} transition={{ duration: 0.4 }} />
        <circle cx="296" cy="130" r="3" fill="var(--lime)" />
        <circle cx="580" cy="96" r="3" fill={drifted ? "#fff" : "#c8f04a"} />
        {/* vessel */}
        <motion.g animate={{ x: vesselX }} initial={false} transition={reduce ? { duration: 0 } : { duration: 1.6, ease: [0.4, 0, 0.2, 1] }}>
          <g transform={`translate(0 ${phase >= 2 && phase <= 3 ? 140 : phase === 1 ? 156 : 170})`}>
            <path d="M0 8 H70 L60 26 H10 Z" fill="var(--ink)" />
            <rect x="28" y="-8" width="18" height="16" fill="var(--paper)" stroke="var(--ink)" strokeWidth={STROKE} />
          </g>
        </motion.g>
        {/* nameplate */}
        <g transform="translate(610 80)">
          <rect width="132" height="34" rx="6" fill="var(--paper)" stroke={drifted ? "var(--signal-red)" : "var(--ink)"} strokeWidth={STROKE} />
          <text x="12" y="23" fontSize="18" fill={drifted ? "var(--signal-red)" : "var(--ink)"} style={{ fontFamily: "var(--font-display)" }}>
            {name}
          </text>
        </g>
        <g style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }} fontSize="11" fill="var(--muted)">
          <text x="24" y="282">ELYSIUM</text>
          <text x="324" y="282">LOCKAGE GATE</text>
          <text x="604" y="282">HYPEREVM MIRROR</text>
        </g>
        {drifted && (
          <g transform="translate(330 40)">
            <rect width="230" height="30" rx="15" fill="var(--paper)" stroke="var(--signal-red)" strokeWidth={STROKE} />
            <text x="115" y="20" textAnchor="middle" fontSize="12" fill="var(--signal-red)" style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
              MirrorIdentityDrift
            </text>
          </g>
        )}
      </svg>
      <figcaption className="mt-3 text-[15px] text-ink-2 min-h-[48px]" aria-live="polite">
        {cap}
      </figcaption>
    </figure>
  );
}
