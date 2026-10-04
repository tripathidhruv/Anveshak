export function LogoMark({ size = 22 }: { size?: number }) {
  // Eight-ray "trace burst": one origin, every direction followed.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <radialGradient id="kz-core" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ffb08a" />
          <stop offset="100%" stopColor="#ff4f12" />
        </radialGradient>
      </defs>
      <g fill="#ff4f12">
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x="11" y="1.5" width="2" height="6" rx="1" transform={`rotate(${i * 45} 12 12)`} />
        ))}
      </g>
      <circle cx="12" cy="12" r="3.6" fill="url(#kz-core)" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2">
      <LogoMark />
      <span className="k-num text-[19px] tracking-[-0.03em] text-text">Kaizen</span>
    </div>
  )
}
