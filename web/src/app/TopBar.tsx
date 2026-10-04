import { useLocation } from 'react-router-dom'
import { Bell, Command, LayoutGrid, Menu, MessageSquareText, Search } from 'lucide-react'
import { DemoChip } from '@/components/kit'
import { ThemeSwitch } from './ThemeSwitch'
import { sectionFor, tabFor } from './nav'
import { CASE } from '@/data/demo'

export function TopBar({ onSearch, onMenu }: { onSearch: () => void; onMenu: () => void }) {
  const { pathname } = useLocation()
  const item = sectionFor(pathname)
  const tab = item?.tabs ? tabFor(pathname) : undefined
  return (
    <header className="k-glass-bar sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 md:px-7">
      <button onClick={onMenu} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-white/5 lg:hidden" aria-label="Open menu">
        <Menu className="size-4.5" />
      </button>
      <div className="flex min-w-0 items-center gap-2 whitespace-nowrap text-[14.5px]">
        <span className="hidden text-dim xl:inline">Anveshak /</span>
        <span className={tab ? 'hidden text-dim lg:inline' : 'truncate text-text'}>{item?.label ?? 'Command Center'}{tab ? ' /' : ''}</span>
        {tab && <span className="truncate text-text">{tab.label}</span>}
      </div>

      <div className="mx-auto hidden md:block">
        <button
          onClick={onSearch}
          className="k-btn-ghost group flex h-10 w-[300px] items-center gap-2.5 pl-3.5 pr-1.5 text-left lg:w-[380px]"
        >
          <Search className="size-4 text-muted" />
          <span className="flex-1 truncate text-[13.5px] text-dim">Search wallet, case or command</span>
          <span className="grid size-7 place-items-center rounded-full border border-line-2 bg-white/[0.05] text-muted">
            <Command className="size-3.5" />
          </span>
          <span className="rounded-full border border-line-2 bg-white/[0.05] px-2.5 py-1 text-[12px] text-muted">K</span>
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1.5 md:ml-0">
        <ThemeSwitch className="hidden md:flex" />
        <DemoChip className="hidden sm:inline-flex" />
        <button onClick={onSearch} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-text md:hidden" aria-label="Search">
          <Search className="size-4" />
        </button>
        <button className="hidden size-9 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-text sm:grid" aria-label="Apps">
          <LayoutGrid className="size-4" />
        </button>
        <button className="relative grid size-9 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-text" aria-label="Notifications">
          <Bell className="size-4" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-ember shadow-[0_0_8px_var(--k-ember)]" />
        </button>
        <button className="hidden size-9 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-text sm:grid" aria-label="Messages">
          <MessageSquareText className="size-4" />
        </button>
        <div className="ml-1 flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-full border border-line-2 bg-white/[0.08] backdrop-blur text-[12.5px] font-semibold text-text">
            KR
          </div>
          <div className="hidden whitespace-nowrap leading-tight 2xl:block">
            <div className="text-[13.5px] text-text">{CASE.officer}</div>
            <div className="text-[12px] text-dim">Cyber Cell · Jaipur</div>
          </div>
        </div>
      </div>
    </header>
  )
}
