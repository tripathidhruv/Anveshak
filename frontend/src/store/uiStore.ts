import { create } from 'zustand'

export interface Toast {
  id: string
  message: string
}

/** The three tabs on the Evidence screen (Task 6). */
export type EvidenceTab = 'graph' | 'report' | 'action'

interface UIState {
  judgeMode: boolean
  toasts: Toast[]
  activeEvidenceTab: EvidenceTab
  toggleJudgeMode: () => void
  showToast: (message: string) => void
  dismissToast: (id: string) => void
  setActiveEvidenceTab: (tab: EvidenceTab) => void
}

let nextToastId = 0

/** Cross-cutting UI state: Judge Mode on/off, toast queue, active evidence tab. */
export const useUIStore = create<UIState>((set) => ({
  judgeMode: true,
  toasts: [],
  activeEvidenceTab: 'graph',
  toggleJudgeMode: () => set((state) => ({ judgeMode: !state.judgeMode })),
  showToast: (message) =>
    set((state) => ({
      toasts: [...state.toasts, { id: `toast-${nextToastId++}`, message }],
    })),
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
  setActiveEvidenceTab: (activeEvidenceTab) => set({ activeEvidenceTab }),
}))
