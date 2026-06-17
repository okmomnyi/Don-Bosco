export function HorizonLine({ className = "" }: { className?: string }) {
  return (
    <div
      role="presentation"
      className={`relative h-px w-full bg-horizon ${className}`}
    >
      <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold shadow-[0_0_12px_2px_rgba(255,213,107,0.55)]" />
    </div>
  );
}

export function SunMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2.5 w-2.5 rounded-full bg-horizon ${className}`}
    />
  );
}

/**
 * A small dawn/horizon scene used as a recurring signature motif.
 * variant "rise" = sun mostly above the line (used in hero / open sections)
 * variant "set"  = sun mostly below the line (used in closing / footer sections)
 */
export function HorizonScene({
  variant = "rise",
  className = "",
}: {
  variant?: "rise" | "set";
  className?: string;
}) {
  const sunCy = variant === "rise" ? 60 : 92;
  return (
    <svg
      viewBox="0 0 200 100"
      preserveAspectRatio="none"
      aria-hidden
      className={className}
    >
      <defs>
        <linearGradient id={`sun-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF8552" />
          <stop offset="100%" stopColor="#FFD56B" />
        </linearGradient>
      </defs>
      <circle cx="100" cy={sunCy} r="34" fill={`url(#sun-${variant})`} opacity="0.9" />
      <rect x="0" y="92" width="200" height="8" fill="currentColor" opacity="0.08" />
    </svg>
  );
}
