/** Line glyphs for everything the lenses draw, one per kind of element. */
const PATHS = {
  // Web
  page: 'M2 2h12v12H2z M2 5h12 M3.5 3.5h.01 M5 3.5h.01',
  layout: 'M2 2h12v12H2z M2 5h12 M6 5v9',
  component: 'M2 6h12v7H2z M4 6V3.5h3V6 M9 6V3.5h3V6',
  hook: 'M10 2v8a3.5 3.5 0 0 1-7 0V8 M1.5 9.5 3 8l1.5 1.5',
  store: 'M3 2.5h10v3H3z M3 6.5h10v3H3z M3 10.5h10v3H3z',
  service: 'M2 2h7v7H2z M7 7h7v7H7z',
  server: 'M2 2h12v5H2z M2 9h12v5H2z M4 4.5h1.5 M4 11.5h1.5',
  entry: 'M8 2h6v12H8 M1.5 8H10 M7 5l3 3-3 3',
  style: 'M5.5 2 4.5 14 M11.5 2l-1 12 M2 6h12 M2 10h12',
  asset: 'M2 2h12v12H2z M2 12l4-4 3 3 2-2 3 3 M10.5 5.5h.01',
  config: 'M2 4h12 M2 8h12 M2 12h12 M5 2v4 M10.5 6v4 M7 10v4',
  test: 'M2 2h12v12H2z M5 8l2 2 4-4',
  // API
  controller: 'M3 14V4.5L8 2l5 2.5V14 M2 14h12 M6 14v-4h4v4',
  repository: 'M2 4.5h5l1.5 2H14V14H2z',
  model: 'M8 2l6 6-6 6-6-6z',
  middleware: 'M2 3h12L10 8v5l-4 1.5V8z',
  data: 'M3 4c0-2.2 10-2.2 10 0v8c0 2.2-10 2.2-10 0z M3 4c0 2.2 10 2.2 10 0 M3 8c0 2.2 10 2.2 10 0',
  startup: 'M8 1.5V8 M4.5 4a5 5 0 1 0 7 0',
  other: 'M3 3h10v10H3z',
  lock: 'M4 7.5h8V14H4z M5.8 7.5V5.5a2.2 2.2 0 0 1 4.4 0v2',
  // Database
  table: 'M2 3h12v10H2z M2 6.5h12 M2 10h12 M6 6.5V13',
  package: 'M2 5l6-3 6 3v7l-6 3-6-3z M2 5l6 3 6-3 M8 8v7',
  procedure: 'M4 3l8 5-8 5z',
  function: 'M11.5 2.5c-2.5-.5-3.4.6-3.8 3L6.3 13.5 M4.5 7h6',
  view: 'M1 8c3-5.3 11-5.3 14 0-3 5.3-11 5.3-14 0z M8 6.3a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4',
  trigger: 'M9.5 1.5 4 9h4l-1 5.5L12.5 7h-4z',
  sequence: 'M3 13.5V10 M8 13.5V6.5 M13 13.5V2.5',
  type: 'M6 2.5c-1.8 0-2 .8-2 2.5s-.7 3-2 3c1.3 0 2 1.3 2 3s.2 2.5 2 2.5 M10 2.5c1.8 0 2 .8 2 2.5s.7 3 2 3c-1.3 0-2 1.3-2 3s-.2 2.5-2 2.5',
  key: 'M5.5 13a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6 M7.5 8.3 13.5 2.5 M11.5 4.5l2 2',
} as const

export type LensIconName = keyof typeof PATHS

export function LensIcon({ name, className }: { name: LensIconName; className?: string }) {
  return (
    <svg
      className={`lens-icon ${className ?? ''}`}
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
