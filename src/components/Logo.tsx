export function LogoMark({ size = 26 }: { size?: number }) {
  // three stepped chambers climbing left to right, the middle one holding a vessel at the waterline
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect x="1.5" y="17" width="8" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11.5" y="10" width="9" height="19" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="22.5" y="3" width="8" height="26" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 21h6" stroke="var(--lime-deep)" strokeWidth="2" strokeLinecap="round" />
      <path d="M2.5 22h6M23.5 12h6" stroke="var(--lime-deep)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="sans-display text-[19px] tracking-[-0.04em]" style={{ fontWeight: 600 }}>
        LOCKAGE
      </span>
    </span>
  );
}
