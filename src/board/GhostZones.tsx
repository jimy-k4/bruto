import { memo, useMemo, useRef } from 'react'
import type { GhostNote, GhostZone, Note, Point } from '../types'
import { NOTE_MIN_SIZE } from '../domain/constants'
import { ghostArrows, ghostKey, projectKey, zoneKey, type GhostEnd } from '../domain/ghosts'
import { shortId } from '../domain/workspace'
import { kindLabel, statusLabel, useI18n } from '../i18n'
import { formatAge } from '../ui/noteAge'
import type { ZoneState } from '../workspace/ghostZones'
import { boundingRect, connectionPath, noteRect, type NoteSizes, type Rect } from './geometry'

/** Room around a zone's notes inside its dotted frame. */
const FRAME_PADDING = 28

const ghostRect = (zone: GhostZone, ghost: GhostNote, sizes: NoteSizes): Rect => ({
  x: ghost.x + zone.offset.x,
  y: ghost.y + zone.offset.y,
  // Ghost cards are measured like notes, under a key no note id can take.
  ...(sizes.get(ghostKey(zone, ghost.id)) ?? NOTE_MIN_SIZE),
})

export interface GhostZoneHandlers {
  observe: (id: string, element: HTMLElement) => () => void
  screenToWorld: (clientX: number, clientY: number) => Point
  /** Moves a zone, by its key. */
  onMove: (zone: string, offset: Point) => void
  onMoveEnd: () => void
  /** Goes to the zone's project, at one of its notes. */
  onOpen: (zone: GhostZone, noteId: string) => void
  onRefresh: (zone: GhostZone) => void
  isConnecting: () => boolean
  /** Starts or ends an arrow at a ghost, by its key: one to a note here links the two. */
  onConnectVia: (key: string) => void
}

interface GhostZonesProps {
  zones: GhostZone[]
  states: Map<string, ZoneState>
  sizes: NoteSizes
  handlers: GhostZoneHandlers
  connectingFrom: string | null
}

/** Notes of linked projects, read only, laid out as on their boards inside a dotted frame. */
export const GhostZones = memo(function GhostZones({
  zones,
  states,
  sizes,
  handlers,
  connectingFrom,
}: GhostZonesProps) {
  return zones.map((zone) => (
    <GhostZoneView
      key={zoneKey(zone)}
      zone={zone}
      state={states.get(
        projectKey({ project: zone.hops > 1 && zone.via ? zone.via : zone.project }),
      )}
      sizes={sizes}
      handlers={handlers}
      connectingFrom={connectingFrom}
    />
  ))
})

interface GhostZoneViewProps {
  zone: GhostZone
  state: ZoneState | undefined
  sizes: NoteSizes
  handlers: GhostZoneHandlers
  connectingFrom: string | null
}

function GhostZoneView({ zone, state, sizes, handlers, connectingFrom }: GhostZoneViewProps) {
  const { t, language } = useI18n()
  const drag = useRef<{ start: Point; offset: Point } | null>(null)
  const project = zone.project.toUpperCase()
  const frame = boundingRect(zone.notes.map((ghost) => ghostRect(zone, ghost, sizes)))!
  // The note the zone opens at: one linked to another project, or the first.
  const entry = zone.notes.find((ghost) => ghost.crossLinks?.length) ?? zone.notes[0]
  const age = zone.syncedAt ? formatAge(language, zone.syncedAt) : null
  const copy =
    state === 'read'
      ? t('ghostZoneFresh')
      : [
          state === 'locked' && t('ghostZoneLocked'),
          state === 'missing' && t('ghostZoneMissing'),
          age && t('ghostZoneCopy', { age }),
        ]
          .filter(Boolean)
          .join(' · ')

  // The whole zone moves as one: its notes keep their places as on their board.
  const startDrag = (event: React.PointerEvent<HTMLElement>) => {
    // Nothing in a zone pans the board or starts a selection; its buttons keep their click.
    event.stopPropagation()

    if ((event.target as HTMLElement).closest('button')) return

    // A ghost can start or end an arrow, as a note does: middle click, or a click while connecting.
    const card = (event.target as HTMLElement).closest<HTMLElement>('[data-ghost-id]')

    if (card && (event.button === 1 || (event.button === 0 && handlers.isConnecting()))) {
      event.preventDefault()
      handlers.onConnectVia(ghostKey(zone, card.dataset.ghostId!))
      return
    }

    if (event.button !== 0) return

    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      start: handlers.screenToWorld(event.clientX, event.clientY),
      offset: zone.offset,
    }
  }

  const moveDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (!drag.current) return

    const point = handlers.screenToWorld(event.clientX, event.clientY)
    const { start, offset } = drag.current

    handlers.onMove(zoneKey(zone), {
      x: offset.x + point.x - start.x,
      y: offset.y + point.y - start.y,
    })
  }

  const endDrag = () => {
    if (!drag.current) return

    drag.current = null
    handlers.onMoveEnd()
  }

  return (
    <div
      className="ghost-zone"
      role="group"
      aria-label={t('ghostZone', { project })}
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className="ghost-zone__frame"
        style={{
          left: frame.x - FRAME_PADDING,
          top: frame.y - FRAME_PADDING,
          width: frame.width + FRAME_PADDING * 2,
          height: frame.height + FRAME_PADDING * 2,
        }}
      >
        <header className="ghost-zone__label">
          <span className="ghost-zone__name">{t('ghostZone', { project })}</span>
          {zone.via && zone.hops > 1 && (
            <span className="ghost-zone__via">
              {t('ghostZoneVia', { project: zone.via.toUpperCase() })}
            </span>
          )}
          {copy && <span className="ghost-zone__copy">{copy}</span>}

          <span className="ghost-zone__actions">
            <button
              type="button"
              className="button button--small"
              onClick={() => handlers.onRefresh(zone)}
            >
              {t('ghostZoneRefresh')}
            </button>
            <button
              type="button"
              className="button button--small"
              onClick={() => handlers.onOpen(zone, entry.id)}
            >
              {t('ghostZoneOpen', { project })} ↗
            </button>
          </span>
        </header>
      </div>

      {zone.notes.map((ghost) => (
        <GhostCard
          key={ghost.id}
          zone={zone}
          ghost={ghost}
          observe={handlers.observe}
          sizeKey={ghostKey(zone, ghost.id)}
          connecting={connectingFrom === ghostKey(zone, ghost.id)}
          onOpen={() => handlers.onOpen(zone, ghost.id)}
        />
      ))}
    </div>
  )
}

interface GhostCardProps {
  zone: GhostZone
  ghost: GhostNote
  sizeKey: string
  connecting: boolean
  observe: GhostZoneHandlers['observe']
  onOpen: () => void
}

function GhostCard({ zone, ghost, sizeKey, connecting, observe, onOpen }: GhostCardProps) {
  const { t } = useI18n()
  const title = ghost.title.trim() || t('untitled')
  const ref = (element: HTMLElement | null) => {
    if (element) return observe(sizeKey, element)
  }

  return (
    <article
      ref={ref}
      className={`note note--ghost note-color-${ghost.colorTheme} note-pattern-${ghost.pattern}${connecting ? ' is-connecting' : ''}`}
      style={{ left: ghost.x + zone.offset.x, top: ghost.y + zone.offset.y }}
      data-ghost-id={ghost.id}
      tabIndex={0}
      aria-roledescription={t('ghostNote')}
      aria-label={[
        title,
        ghost.kind && kindLabel(t, ghost.kind),
        ghost.status && statusLabel(t, ghost.status),
        t('ghostNoteOf', { project: zone.project.toUpperCase() }),
      ]
        .filter(Boolean)
        .join(', ')}
      title={t('ghostNoteOpen', { project: zone.project.toUpperCase() })}
      onDoubleClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen()
      }}
    >
      <header className="note__header">
        <span className={ghost.kind ? `note__kind note__kind--${ghost.kind}` : 'note__kind'}>
          {ghost.kind ? kindLabel(t, ghost.kind) : t('note')}
        </span>
        {ghost.status && (
          <span className={`status-badge status-badge--${ghost.status}`}>
            {statusLabel(t, ghost.status)}
          </span>
        )}
        <span className="note__id">{shortId(ghost.id)}</span>
      </header>

      <div className="note__body">
        <h3 className="note__title">{title}</h3>
        {ghost.description ? (
          <p className="note__description">{ghost.description}</p>
        ) : (
          <p className="note__description note__description--empty">{t('noDescription')}</p>
        )}
        {ghost.files?.length ? (
          <p className="note--ghost__files">{t('filesCount', { count: ghost.files.length })}</p>
        ) : null}
      </div>
    </article>
  )
}

interface GhostArrowsProps {
  notes: Note[]
  zones: GhostZone[]
  sizes: NoteSizes
}

/** Dotted arrows: inside each zone as on its board, and across projects where notes are linked. */
export const GhostArrows = memo(function GhostArrows({ notes, zones, sizes }: GhostArrowsProps) {
  const paths = useMemo(() => {
    const notesById = new Map(notes.map((note) => [note.id, note]))
    const zonesByKey = new Map(zones.map((zone) => [zoneKey(zone), zone]))

    const rectOf = (end: GhostEnd): Rect | null => {
      if (!end.zone) {
        const note = notesById.get(end.id)

        return note ? noteRect(note, sizes) : null
      }

      const zone = zonesByKey.get(end.zone)
      const ghost = zone?.notes.find((item) => item.id === end.id)

      return zone && ghost ? ghostRect(zone, ghost, sizes) : null
    }

    const inside = zones.flatMap((zone) =>
      zone.connections.map((connection) => ({
        key: `${zoneKey(zone)}|${connection.id}`,
        from: rectOf({ zone: zoneKey(zone), id: connection.from }),
        to: rectOf({ zone: zoneKey(zone), id: connection.to }),
        directed: true,
        across: false,
      })),
    )
    const across = ghostArrows({ notes, ghosts: zones }).map((arrow) => ({
      key: arrow.key,
      from: rectOf(arrow.from),
      to: rectOf(arrow.to),
      directed: arrow.directed,
      across: true,
    }))

    return [...inside, ...across].flatMap(({ from, to, ...arrow }) =>
      from && to ? [{ ...arrow, d: connectionPath(from, to, false) }] : [],
    )
  }, [notes, zones, sizes])

  return (
    <svg className="connections ghost-arrows" aria-hidden="true">
      <defs>
        <marker
          id="ghost-arrow"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" />
        </marker>
      </defs>

      {paths.map((path) => (
        <path
          key={path.key}
          className={`ghost-arrow ${path.across ? 'ghost-arrow--across' : ''}`}
          d={path.d}
          markerEnd={path.directed ? 'url(#ghost-arrow)' : undefined}
        />
      ))}
    </svg>
  )
})
