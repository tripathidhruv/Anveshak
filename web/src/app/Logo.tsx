import * as React from 'react'

/**
 * ANVESHAK mark: an "A" drawn as a money trail. The left leg climbs from the victim's wallet, the apex is
 * the collection hub, the right leg runs down to the exchange — the gold node that the trace finds.
 * The crossbar is the hop between them. Same geometry as public/favicon.svg.
 */
export function LogoMark({ size = 24 }: { size?: number }) {
  const id = React.useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id={`av-leg${id}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff4f12" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#ff7a3d" />
          <stop offset="100%" stopColor="#ffb08a" />
        </linearGradient>
        <radialGradient id={`av-gold${id}`}>
          <stop offset="0%" stopColor="#ffe3a3" />
          <stop offset="100%" stopColor="#f5a524" />
        </radialGradient>
        <filter id={`av-glow${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>
      {/* trail */}
      <path d="M6.5 26 L16 5.5 L25.5 26" fill="none" stroke={`url(#av-leg${id})`} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.2 18.6 H20.8" stroke="#ff7a3d" strokeWidth="2.4" strokeLinecap="round" strokeOpacity="0.85" />
      {/* victim → hub → exchange */}
      <circle cx="6.5" cy="26" r="2.3" fill="#141415" stroke="#ff4f12" strokeWidth="1.6" />
      <circle cx="16" cy="5.5" r="2.4" fill="#fff4ee" />
      <circle cx="25.5" cy="26" r="4.2" fill="#f5a524" opacity="0.55" filter={`url(#av-glow${id})`} />
      <circle cx="25.5" cy="26" r="2.9" fill={`url(#av-gold${id})`} />
    </svg>
  )
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={28} />
      <div className="leading-none">
        <div className="k-brand text-[15.5px] text-text">ANVESHAK</div>
        <div className="k-deva mt-[3px] text-[11.5px] text-muted">अन्वेषक · the seeker</div>
      </div>
    </div>
  )
}
