import { createContext, useContext } from 'react'

export interface ToastOptions {
  message: string
  tone?: 'info' | 'success' | 'error'
  /** Optional button, e.g. "Undo". */
  action?: { label: string; run: () => void }
  /** Milliseconds on screen; errors stay a bit longer by default. */
  duration?: number
}

export interface Toast extends ToastOptions {
  id: number
}

export type ShowToast = (options: ToastOptions) => void

export const ToastContext = createContext<ShowToast | null>(null)

export function useToast(): ShowToast {
  const show = useContext(ToastContext)

  if (!show) {
    throw new Error('useToast must be used inside <ToastProvider>')
  }

  return show
}
