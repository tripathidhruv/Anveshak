/**
 * The KAIZEN "KZ" monogram — interlocking K/Z strokes, white on a dark badge, matching the
 * supplied brand mark. Colours are literal hex rather than `var(--...)` since this asset is
 * also exported standalone as favicon.svg, which has no access to the app's CSS custom
 * properties.
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="KAIZEN logo"
    >
      <rect x="0" y="0" width="100" height="100" rx="22" fill="#4338CA" />
      {/* K — vertical stem with two arms fanning out from its mid-point (mirrored across y=50) */}
      <rect x="8" y="8" width="14" height="84" rx="7" fill="#fff" />
      <path d="M22 43 L52 8 H66 L36 50 Z" fill="#fff" />
      <path d="M22 57 L52 92 H66 L36 50 Z" fill="#fff" />
      {/* Z — top bar, bottom bar, and a top-right-to-bottom-left diagonal stroke */}
      <rect x="52" y="8" width="40" height="14" rx="7" fill="#fff" />
      <rect x="52" y="78" width="40" height="14" rx="7" fill="#fff" />
      <path d="M78 22 L92 22 L66 78 L52 78 Z" fill="#fff" />
    </svg>
  )
}
