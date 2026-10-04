export type Tone = 'ember' | 'crimson' | 'gold' | 'teal' | 'violet' | 'sky' | 'moss' | 'neutral' | 'white'

export const TONE_HEX: Record<Tone, string> = {
  ember: '#ff4f12',
  crimson: '#e5322d',
  gold: '#f5a524',
  teal: '#2dd4bf',
  violet: '#a78bfa',
  sky: '#60a5fa',
  moss: '#4ade80',
  neutral: '#8b8b90',
  white: '#f4f4f5',
}

export function toneHex(t: Tone): string {
  return TONE_HEX[t]
}

/** rgba() of a tone at alpha a. */
export function toneA(t: Tone, a: number): string {
  const h = TONE_HEX[t].slice(1)
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}
