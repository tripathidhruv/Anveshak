import { useEffect } from 'react'
import { useUIStore } from '@/store/uiStore'
import { cn } from '@/lib/utils'

const AUTO_DISMISS_MS = 3000

function ToastItem({ id, message }: { id: string; message: string }) {
  const dismissToast = useUIStore((state) => state.dismissToast)

  useEffect(() => {
    const timer = window.setTimeout(() => dismissToast(id), AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [id, dismissToast])

  return (
    <div
      role="status"
      className={cn(
        'animate-in slide-in-from-bottom-4 fade-in rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-lg',
      )}
    >
      {message}
    </div>
  )
}

/** Toast host, driven entirely by `uiStore` — mount once near the app root. */
function ToastHost() {
  const toasts = useUIStore((state) => state.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem id={toast.id} message={toast.message} />
        </div>
      ))}
    </div>
  )
}

export { ToastHost }
