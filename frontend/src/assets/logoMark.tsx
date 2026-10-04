/**
 * The ANVESHAK mark — an "A" drawn as a money trail: the left leg climbs from the victim's wallet,
 * the apex is the collection hub, the right leg runs down to the exchange (gold, per the fixed colour
 * semantics) that the trace finds. Colours are literal hex rather than `var(--...)` since this asset is
 * also exported standalone as favicon.svg, which has no access to the app's CSS custom properties.
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="ANVESHAK logo">
      <rect x="0" y="0" width="100" height="100" rx="22" fill="#4338CA" />
      <path d="M24 78 L50 20 L76 78" stroke="#fff" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M36.5 57 H63.5" stroke="#fff" strokeOpacity="0.8" strokeWidth="7" strokeLinecap="round" />
      <circle cx="24" cy="78" r="7" fill="#4338CA" stroke="#fff" strokeWidth="4.5" />
      <circle cx="50" cy="20" r="7.5" fill="#fff" />
      <circle cx="76" cy="78" r="10" fill="#D97706" stroke="#fff" strokeWidth="3" />
    </svg>
  )
}
