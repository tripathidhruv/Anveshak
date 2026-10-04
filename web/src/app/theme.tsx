import * as React from 'react'
import { TONE_HEX } from '@/components/kit/tone'

/**
 * Three liquid-glass themes. CSS owns the surfaces (`:root[data-theme=…]` in index.css); this file
 * owns the one JS-side colour that changes — the brand accent `ember`, which charts and glows read
 * through `toneHex('ember')`. Meaning colours (crimson, gold, teal, violet, sky, moss) never change.
 */
export const THEMES = [
  { key: 'graphite', label: 'Graphite', accent: '#f2f2f4', swatch: 'linear-gradient(135deg,#f4f4f5,#6b6b70)' },
  { key: 'ember', label: 'Ember', accent: '#ff4f12', swatch: 'linear-gradient(135deg,#ff8a4c,#ff4f12)' },
  { key: 'violet', label: 'Violet', accent: '#b69cff', swatch: 'linear-gradient(135deg,#c4b5fd,#6646f0)' },
] as const
export type ThemeKey = (typeof THEMES)[number]['key']

const KEY = 'anveshak.theme'

export function initialTheme(): ThemeKey {
  try {
    const t = localStorage.getItem(KEY)
    if (THEMES.some((x) => x.key === t)) return t as ThemeKey
  } catch {
    /* storage blocked — fall back to the default */
  }
  return 'graphite'
}

export function applyTheme(t: ThemeKey) {
  document.documentElement.dataset.theme = t
  TONE_HEX.ember = THEMES.find((x) => x.key === t)!.accent
}

type Ctx = { theme: ThemeKey; setTheme: (t: ThemeKey) => void }
const ThemeContext = React.createContext<Ctx>({ theme: 'graphite', setTheme: () => {} })

/** Re-keys its children on change so every inline colour computed from `toneHex('ember')` refreshes. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, set] = React.useState<ThemeKey>(initialTheme)
  const setTheme = React.useCallback((t: ThemeKey) => {
    applyTheme(t)
    try {
      localStorage.setItem(KEY, t)
    } catch {
      /* not persisted — fine */
    }
    set(t)
  }, [])
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <React.Fragment key={theme}>{children}</React.Fragment>
    </ThemeContext.Provider>
  )
}

export const useTheme = () => React.useContext(ThemeContext)
