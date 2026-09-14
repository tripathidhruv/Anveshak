import { useEffect } from 'react'
import { useUIStore } from '../../../store/uiStore'
import styles from './Toast.module.css'

const AUTO_DISMISS_MS = 3000

function ToastItem({ id, message }: { id: string; message: string }) {
  const dismissToast = useUIStore((state) => state.dismissToast)

  useEffect(() => {
    const timer = window.setTimeout(() => dismissToast(id), AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [id, dismissToast])

  return (
    <div className={styles.toast} role="status">
      {message}
    </div>
  )
}

/** Toast host, driven entirely by `uiStore` — mount once near the app root. */
export function ToastHost() {
  const toasts = useUIStore((state) => state.toasts)

  if (toasts.length === 0) return null

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} id={toast.id} message={toast.message} />
      ))}
    </div>
  )
}
