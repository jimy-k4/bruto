import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type Toast, type ToastOptions } from './toasts'

/** Short messages at the bottom of the screen, announced to screen readers. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const show = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++
      const duration = options.duration ?? (options.tone === 'error' ? 7000 : 3500)

      // Only a few at a time: older ones make room.
      setToasts((current) => [...current.slice(-2), { ...options, id }])
      window.setTimeout(() => dismiss(id), duration)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={show}>
      {children}

      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone ?? 'info'}`}>
            <span>{toast.message}</span>

            {toast.action && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  toast.action!.run()
                  dismiss(toast.id)
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
