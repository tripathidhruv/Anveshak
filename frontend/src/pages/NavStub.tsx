import { PagePlaceholder } from './PagePlaceholder'

/**
 * Landing page for sidebar nav chrome that isn't part of this 8-task build
 * (Cases / Trace / Campaigns / Reports / Exchanges list views). These still need a real,
 * navigable route — refreshing here must not white-screen and the URL bar must change —
 * so each gets this instead of a "Coming in v2" toast that never leaves the current page.
 */
export function NavStub({ screenName }: { screenName: string }) {
  return (
    <PagePlaceholder
      screenName={screenName}
      note="Not part of this hackathon build — out of scope for the 8-task frontend migration."
    />
  )
}
