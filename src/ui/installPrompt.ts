import { useSyncExternalStore } from 'react'

/** Chromium's install event: not in TypeScript's DOM library yet. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

// Listen from the start: the browser may announce it before React renders.
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferred = event as BeforeInstallPromptEvent
  notify()
})

window.addEventListener('appinstalled', () => {
  deferred = null
  notify()
})

async function install() {
  const event = deferred

  deferred = null
  notify()
  await event?.prompt()
}

/** Returns a function that installs Bruto as an app, or null when that isn't possible. */
export function useInstallPrompt(): (() => Promise<void>) | null {
  const available = useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => deferred !== null,
  )

  return available ? install : null
}
