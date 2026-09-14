import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { X } from 'lucide-react'
import styles from './Modal.module.css'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
}

/** Neumorphic modal shell — always has a close button, closes on backdrop click and Escape. */
export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="presentation"
    >
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        {title && <h2 className={styles.title}>{title}</h2>}
        {children}
      </div>
    </div>
  )
}
