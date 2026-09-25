/**
 * Anonymous usage events for the published site (Superveil: no cookies, no
 * personal data). Only which feature was used is sent, never what a project
 * or a note contains. Does nothing where the Superveil script isn't loaded:
 * development, tests, offline.
 */
declare global {
  interface Window {
    superveil?: (event: string) => void
  }
}

export type UsageEvent =
  | 'demo-open'
  | 'project-open'
  | 'project-reopen'
  | 'search-open'
  | 'structure-open'
  | 'lens-open'
  | 'ai-context-copy'
  | 'install-prompt'
  | 'app-installed'

/**
 * Superveil events are plain names, so details ride along in the name
 * ("lens-open:web:react"), keeping only the characters Superveil accepts.
 */
export function track(event: UsageEvent, data?: Record<string, string | number>) {
  try {
    const name = [event, ...Object.values(data ?? {})]
      .join(':')
      .replace(/[^\p{L}\p{N}_:. -]/gu, '-')
    window.superveil?.(name)
  } catch {
    // Counting must never break the app.
  }
}
