import { useEffect, useState } from 'react'

/** How often an open Bruto looks for a newer published version. */
const CHECK_INTERVAL = 10 * 60 * 1000

/**
 * True once a newer version of Bruto has been published than the one running.
 * Production builds only: `version.json` is written by the build.
 */
export function useNewVersion(): boolean {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    if (!import.meta.env.PROD || available) return

    let cancelled = false

    const check = async () => {
      if (document.visibilityState !== 'visible') return

      try {
        const response = await fetch(`${import.meta.env.BASE_URL}version.json`, {
          cache: 'no-store',
        })

        if (!response.ok) return

        const { build } = (await response.json()) as { build?: unknown }

        if (!cancelled && typeof build === 'string' && build !== __BUILD_ID__) setAvailable(true)
      } catch {
        // Offline or mid-deploy: the next check will tell.
      }
    }

    const interval = window.setInterval(check, CHECK_INTERVAL)

    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    void check()

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [available])

  return available
}
