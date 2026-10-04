import { motion } from 'motion/react'
import { THEMES, useTheme } from './theme'
import { cn } from '@/lib/utils'

/** Glass pill with three swatches — Graphite · Ember · Violet. */
export function ThemeSwitch({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  return (
    <div role="radiogroup" aria-label="Theme" className={cn('k-glass-bar flex h-9 items-center gap-0.5 rounded-full border p-1', className)}>
      {THEMES.map((t) => {
        const on = t.key === theme
        return (
          <button
            key={t.key}
            type="button"
            role="radio"
            aria-checked={on}
            title={`${t.label} theme`}
            onClick={() => setTheme(t.key)}
            className="relative flex h-7 items-center gap-1.5 rounded-full px-2 text-[12px] text-muted outline-none hover:text-text"
          >
            {on && <motion.span layoutId="theme-pill" className="absolute inset-0 rounded-full bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]" />}
            <span className="relative size-3.5 rounded-full ring-1 ring-white/25" style={{ background: t.swatch }} />
            <span className={cn('relative hidden 2xl:inline', on && 'text-text')}>{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}
