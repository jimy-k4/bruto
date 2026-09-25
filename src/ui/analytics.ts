/**
 * Anonymous usage events for the published site (Umami: no cookies, no
 * personal data). Only which feature was used is sent, never what a project
 * or a note contains. Does nothing where the Umami script isn't loaded:
 * development, tests, offline.
 */
declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, string | number>) => void }
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

export function track(event: UsageEvent, data?: Record<string, string | number>) {
  try {
    window.umami?.track(event, data)
  } catch {
    // Counting must never break the app.
  }
}
