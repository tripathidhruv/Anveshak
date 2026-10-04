import * as React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { useLenis } from 'lenis/react'
import { Sheet, SheetContent, SheetTitle } from '@/components/animate-ui/components/radix/sheet'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { CommandPalette } from './CommandPalette'
import { sectionFor } from './nav'

export function AppShell() {
  const [collapsed, setCollapsed] = React.useState(false)
  const [cmd, setCmd] = React.useState(false)
  const [mobile, setMobile] = React.useState(false)
  const { pathname } = useLocation()
  const lenis = useLenis()

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setCmd((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  React.useEffect(() => {
    lenis?.scrollTo(0, { immediate: true })
  }, [pathname, lenis])

  React.useEffect(() => {
    if (cmd || mobile) lenis?.stop()
    else lenis?.start()
  }, [cmd, mobile, lenis])

  return (
    <div className="flex min-h-screen">
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>

      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" showCloseButton={false} className="w-[256px] border-line bg-[var(--k-pop)] p-0 backdrop-blur-xl">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar collapsed={false} onToggle={() => setMobile(false)} onNavigate={() => setMobile(false)} />
        </SheetContent>
      </Sheet>

      <div className="relative min-w-0 flex-1">
        {/* soft top spotlight over the themed glow backdrop */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
          style={{ background: 'radial-gradient(55% 100% at 50% 0%, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 70%)' }}
        />
        <TopBar onSearch={() => setCmd(true)} onMenu={() => setMobile(true)} />
        <AnimatePresence mode="wait">
          <motion.main
            key={sectionFor(pathname)?.to ?? pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
            className="relative mx-auto w-full max-w-[1520px] px-4 pb-16 pt-2 md:px-7"
          >
            <Outlet />
          </motion.main>
        </AnimatePresence>
      </div>
      <CommandPalette open={cmd} onOpenChange={setCmd} />
    </div>
  )
}
