import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CornerDownLeft, FolderOpen, Route, Search, Wallet } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/animate-ui/components/radix/dialog'
import { cn } from '@/lib/utils'
import { DESTINATIONS } from './nav'
import { CASES, CASE } from '@/data/demo'

type Cmd = { id: string; label: string; hint: string; group: string; icon: React.ComponentType<{ className?: string }>; to: string }

const COMMANDS: Cmd[] = [
  { id: 'trace-primary', label: `Trace wallet ${CASE.suspectWallet}`, hint: 'Run a live trace', group: 'Quick actions', icon: Route, to: '/trace' },
  { id: 'intake', label: 'Parse a new complaint', hint: 'Paste text or drop a screenshot', group: 'Quick actions', icon: Wallet, to: '/cases/new' },
  ...DESTINATIONS.map((n) => ({ id: n.to, label: n.label, hint: n.tech, group: 'Go to', icon: n.icon, to: n.to })),
  ...CASES.slice(0, 6).map((c) => ({ id: c.id, label: `${c.id} · ${c.who}`, hint: `${c.type} · ${c.city}`, group: 'Cases', icon: FolderOpen, to: '/trace' })),
]

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = React.useState('')
  const [idx, setIdx] = React.useState(0)
  const nav = useNavigate()
  const list = React.useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? COMMANDS.filter((c) => (c.label + ' ' + c.hint).toLowerCase().includes(s)) : COMMANDS
  }, [q])

  React.useEffect(() => {
    if (open) {
      setQ('')
      setIdx(0)
    }
  }, [open])
  React.useEffect(() => setIdx(0), [q])

  const run = (c: Cmd | undefined) => {
    if (!c) return
    onOpenChange(false)
    nav(c.to)
  }

  const groups = list.reduce<Record<string, Cmd[]>>((a, c) => ((a[c.group] ||= []).push(c), a), {})
  let flatI = -1

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[18%] max-w-[600px] translate-y-0 gap-0 overflow-hidden rounded-2xl border-line-2 bg-[#141415] p-0 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] sm:max-w-[600px]"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">Search screens, cases and wallet addresses</DialogDescription>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-4 text-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIdx((i) => Math.min(list.length - 1, i + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIdx((i) => Math.max(0, i - 1))
              } else if (e.key === 'Enter') run(list[idx])
            }}
            placeholder="Search a wallet, case ID, or screen…"
            className="h-13 flex-1 bg-transparent text-[15.5px] text-text outline-none placeholder:text-dim"
          />
          <kbd className="rounded-md border border-line-2 px-1.5 py-0.5 text-[11.5px] text-muted">ESC</kbd>
        </div>
        <div className="k-scroll max-h-[380px] overflow-y-auto p-2">
          {list.length === 0 && <div className="px-3 py-10 text-center text-[14px] text-muted">No match. Try a case ID like KZN-2026-0417.</div>}
          {Object.entries(groups).map(([g, items]) => (
            <div key={g} className="mb-1">
              <div className="px-2.5 pb-1 pt-2 text-[12px] text-dim">{g}</div>
              {items.map((c) => {
                flatI++
                const i = flatI
                return (
                  <button
                    key={c.id}
                    onMouseEnter={() => setIdx(i)}
                    onClick={() => run(c)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left',
                      i === idx ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]',
                    )}
                  >
                    <span className="grid size-7 place-items-center rounded-md border border-line bg-raise text-muted">
                      <c.icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] text-text">{c.label}</span>
                      <span className="block truncate text-[12px] text-dim">{c.hint}</span>
                    </span>
                    {i === idx ? <CornerDownLeft className="size-3.5 text-muted" /> : <ArrowRight className="size-3.5 text-dim opacity-0" />}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
