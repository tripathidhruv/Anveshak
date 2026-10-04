import { useLocation } from 'react-router-dom'
import { Bell, Command, LayoutGrid, Menu, MessageSquareText, Search } from 'lucide-react'
import { DemoChip } from '@/components/kit'
import { sectionFor, tabFor } from './nav'
import { CASE } from '@/data/demo'

export function TopBar({ onSearch, onMenu }: { onSearch: () => void; onMenu: () => void }) {
  const { pathname } = useLocation()
  const item = sectionFor(pathname)
  const tab = item?.tabs ? tabFor(pathname) : undefined
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 px-4 md:px-7" style={{ background: 'linear-gradient(180deg, rgba(11,11,12,0.92) 0%, rgba(11,11,12,0.75) 100%)', backdropFilter: 'blur(12px)' }}>
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
          className="group flex h-10 w-[340px] items-center gap-2.5 rounded-full border border-line-2 pl-3.5 pr-1.5 text-left lg:w-[420px]"
          style={{ background: 'linear-gradient(180deg, #232326 0%, #19191b 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 10px 30px -15px rgba(0,0,0,0.8)' }}
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
        <DemoChip className="hidden sm:inline-flex" />
        <button onClick={onSearch} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-text md:hidden" aria-label="Search">
          <Search className="size-4" />
        </button>
        <button className="hidden size-9 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-text sm:grid" aria-label="Apps">
          <LayoutGrid className="size-4" />
        </button>
        <button className="relative grid size-9 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-text" aria-label="Notifications">
          <Bell className="size-4" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-ember shadow-[0_0_8px_#ff4f12]" />
        </button>
        <button className="hidden size-9 place-items-center rounded-lg text-muted hover:bg-white/5 hover:text-text sm:grid" aria-label="Messages">
          <MessageSquareText className="size-4" />
        </button>
        <div className="ml-1 flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-full border border-line-2 bg-gradient-to-b from-[#2b2b2f] to-[#161618] text-[12.5px] font-semibold text-text">
            KR
          </div>
          <div className="hidden leading-tight xl:block">
            <div className="text-[13.5px] text-text">{CASE.officer}</div>
            <div className="text-[12px] text-dim">Cyber Cell · Jaipur</div>
          </div>
        </div>
      </div>
    </header>
  )
}
