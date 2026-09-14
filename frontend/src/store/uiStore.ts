import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
}

interface UIState {
  judgeMode: boolean
  toasts: Toast[]
  toggleJudgeMode: () => void
  showToast: (message: string) => void
  dismissToast: (id: string) => void
}

let nextToastId = 0

/** Cross-cutting UI state: Judge Mode on/off, toast queue. Later tasks add the active evidence tab. */
export const useUIStore = create<UIState>((set) => ({
  judgeMode: true,
  toasts: [],
  toggleJudgeMode: () => set((state) => ({ judgeMode: !state.judgeMode })),
  showToast: (message) =>
    set((state) => ({
      toasts: [...state.toasts, { id: `toast-${nextToastId++}`, message }],
    })),
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
}))
