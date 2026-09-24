import { useEffect, useMemo, useRef, useState } from 'react'
import type { Note, Point, Workspace } from '../types'
import { useI18n } from '../i18n'
import { ConnectionLayer } from './ConnectionLayer'
import { NoteCard, type NoteCardHandlers, type NoteFlash } from './NoteCard'
import { noteRect, rectsOverlap, type NoteSizes, type Rect } from './geometry'
import type { BoardViewApi } from './useBoardView'
import { useStableCallback } from '../ui/useStableCallback'

export interface BoardCallbacks {
  /** Replaces the selection. `open` also opens the note editor. */
  onSelect: (ids: string[], options?: { open?: boolean; focusEditor?: boolean }) => void
  onToggleSelect: (id: string) => void
  onClearSelection: () => void
  onRaise: (ids: string[]) => void
  onMove: (positions: Map<string, Point>) => void
  onMoveEnd: () => void
  onMoveBy: (ids: string[], delta: Point) => void
  onConnectingChange: (id: string | null) => void
  onConnect: (from: string, to: string) => void
  onSelectConnection: (id: string | null) => void
  onDeleteConnection: (id: string) => void
}

interface BoardProps extends BoardCallbacks {
  workspace: Workspace
  view: BoardViewApi
  canvasRef: React.RefObject<HTMLDivElement | null>
  sizes: NoteSizes
  observe: (id: string, element: HTMLElement) => () => void
  selectedIds: string[]
  connectingFrom: string | null
  selectedConnectionId: string | null
  flash: { ids: string[]; kind: Exclude<NoteFlash, null> } | null
}

/** A drag becomes a move only after this many screen pixels; below it, it's a click. */
const DRAG_THRESHOLD = 4
const KEYBOARD_STEP = 10
const KEYBOARD_BIG_STEP = 50

interface Marquee {
  start: Point
  end: Point
  additive: boolean
}

export function Board(props: BoardProps) {
  const { t } = useI18n()
  const {
    workspace,
    view,
    canvasRef,
    sizes,
    selectedIds,
    connectingFrom,
    selectedConnectionId,
    flash,
  } = props
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [marquee, setMarquee] = useState<Marquee | null>(null)
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])

  // Handlers read the latest props without changing identity, so memoised
  // cards don't re-render on every board update.
  const latest = useRef(props)
  /** Set on pointer down: focus that comes from a click must not re-select. */
  const focusFromPointer = useRef(false)

  useEffect(() => {
    latest.current = props
  })

  const canvasPoint = (event: { clientX: number; clientY: number }): Point => {
    const rect = canvasRef.current!.getBoundingClientRect()

    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  // Wheel zoom needs a non-passive listener to stop the page from zooming too.
  const { zoomAround } = view

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()

      const rect = canvas.getBoundingClientRect()

      zoomAround(event.deltaY < 0 ? 1.1 : 1 / 1.1, {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      })
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })

    return () => canvas.removeEventListener('wheel', onWheel)
  }, [canvasRef, zoomAround])

  const connectVia = (id: string) => {
    const current = latest.current

    current.onSelectConnection(null)

    if (!current.connectingFrom) {
      current.onConnectingChange(id)
    } else if (current.connectingFrom === id) {
      current.onConnectingChange(null)
    } else {
      current.onConnect(current.connectingFrom, id)
      current.onConnectingChange(null)
    }
  }

  const handleNotePointerDown = useStableCallback(
    (event: React.PointerEvent<HTMLElement>, note: Note) => {
      const current = latest.current

      event.stopPropagation()

      if (event.button === 1) {
        event.preventDefault()
        connectVia(note.id)
        return
      }

      if (event.button !== 0) return

      if (current.connectingFrom && current.connectingFrom !== note.id) {
        current.onConnect(current.connectingFrom, note.id)
        current.onConnectingChange(null)
        return
      }

      current.onSelectConnection(null)

      const element = event.currentTarget
      const additive = event.shiftKey || event.ctrlKey || event.metaKey
      const group =
        current.selectedIds.length > 1 && current.selectedIds.includes(note.id)
          ? current.selectedIds
          : [note.id]

      const start = { x: event.clientX, y: event.clientY }
      const origins = new Map(
        current.workspace.notes
          .filter((item) => group.includes(item.id))
          .map((item) => [item.id, { x: item.x, y: item.y }]),
      )

      let moved = false

      focusFromPointer.current = true
      element.setPointerCapture(event.pointerId)

      const move = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - start.x
        const dy = moveEvent.clientY - start.y

        if (!moved) {
          if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return

          moved = true
          current.onRaise(group)
          setDraggingId(note.id)
        }

        const zoom = view.zoom
        const positions = new Map<string, Point>()

        origins.forEach((origin, id) => {
          positions.set(id, { x: origin.x + dx / zoom, y: origin.y + dy / zoom })
        })

        latest.current.onMove(positions)
      }

      const end = () => {
        focusFromPointer.current = false
        element.removeEventListener('pointermove', move)
        element.removeEventListener('pointerup', end)
        element.removeEventListener('pointercancel', end)

        if (moved) {
          setDraggingId(null)
          latest.current.onMoveEnd()
          return
        }

        // It was a click.
        const now = latest.current

        if (additive) {
          now.onToggleSelect(note.id)
        } else if (!(now.selectedIds.length > 1 && now.selectedIds.includes(note.id))) {
          now.onSelect([note.id], { open: true })
        }
      }

      element.addEventListener('pointermove', move)
      element.addEventListener('pointerup', end)
      element.addEventListener('pointercancel', end)
    },
  )

  const handlers = useMemo<NoteCardHandlers>(
    () => ({
      observe: props.observe,
      onPointerDown: handleNotePointerDown,
      onDoubleClick: (event, note) => {
        event.stopPropagation()
        latest.current.onSelect([note.id], { open: true })
      },
      onFocus: (note) => {
        // A click selects on pointer up (it may be a drag or a Shift+click);
        // any other focus (Tab, a script) selects right away.
        if (focusFromPointer.current) {
          focusFromPointer.current = false
          return
        }

        const current = latest.current

        if (!current.selectedIds.includes(note.id)) current.onSelect([note.id])
      },
      onKeyDown: (event, note) => {
        if (event.target !== event.currentTarget) return

        const current = latest.current

        if (event.key === 'Enter') {
          event.preventDefault()
          current.onSelect([note.id], { open: true, focusEditor: true })
          return
        }

        if (event.key === ' ') {
          event.preventDefault()
          current.onToggleSelect(note.id)
          return
        }

        const step = event.shiftKey ? KEYBOARD_BIG_STEP : KEYBOARD_STEP
        const deltas: Record<string, Point> = {
          ArrowLeft: { x: -step, y: 0 },
          ArrowRight: { x: step, y: 0 },
          ArrowUp: { x: 0, y: -step },
          ArrowDown: { x: 0, y: step },
        }

        const delta = deltas[event.key]

        if (delta && !event.ctrlKey && !event.altKey && !event.metaKey) {
          event.preventDefault()

          const ids = current.selectedIds.includes(note.id) ? current.selectedIds : [note.id]

          current.onMoveBy(ids, delta)
        }
      },
    }),
    [props.observe, handleNotePointerDown],
  )

  const startCanvasGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    const canvas = event.currentTarget

    if (event.button === 1) {
      event.preventDefault()

      let last = { x: event.clientX, y: event.clientY }

      canvas.setPointerCapture(event.pointerId)
      canvas.classList.add('is-panning')

      const move = (moveEvent: PointerEvent) => {
        view.panBy(moveEvent.clientX - last.x, moveEvent.clientY - last.y)
        last = { x: moveEvent.clientX, y: moveEvent.clientY }
      }

      const end = () => {
        canvas.classList.remove('is-panning')
        canvas.removeEventListener('pointermove', move)
        canvas.removeEventListener('pointerup', end)
        canvas.removeEventListener('pointercancel', end)
      }

      canvas.addEventListener('pointermove', move)
      canvas.addEventListener('pointerup', end)
      canvas.addEventListener('pointercancel', end)

      return
    }

    if (event.button !== 0) return

    const start = canvasPoint(event)
    const additive = event.shiftKey || event.ctrlKey || event.metaKey
    let current: Marquee = { start, end: start, additive }

    canvas.setPointerCapture(event.pointerId)
    setMarquee(current)

    const move = (moveEvent: PointerEvent) => {
      current = { ...current, end: canvasPoint(moveEvent) }
      setMarquee(current)
    }

    const end = () => {
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', end)
      canvas.removeEventListener('pointercancel', end)
      setMarquee(null)
      finishMarquee(current)
    }

    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', end)
    canvas.addEventListener('pointercancel', end)
  }

  const finishMarquee = ({ start, end, additive }: Marquee) => {
    const now = latest.current
    const box = toRect(start, end)

    // A click on the empty board clears the selection.
    if (box.width < 6 && box.height < 6) {
      if (!additive) {
        now.onClearSelection()
        now.onSelectConnection(null)
      }

      return
    }

    const { pan, zoom } = view
    const world: Rect = {
      x: (box.x - pan.x) / zoom,
      y: (box.y - pan.y) / zoom,
      width: box.width / zoom,
      height: box.height / zoom,
    }

    const hits = now.workspace.notes
      .filter((note) => rectsOverlap(noteRect(note, now.sizes), world))
      .map((note) => note.id)

    now.onSelect(additive ? [...new Set([...now.selectedIds, ...hits])] : hits)
  }

  const flashed = new Set(flash?.ids)
  const transform = `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})`
  const selectedConnection = workspace.connections.find(
    (connection) => connection.id === selectedConnectionId,
  )

  return (
    <div
      ref={canvasRef}
      className={`board ${connectingFrom ? 'is-connecting' : ''}`}
      onPointerDown={startCanvasGesture}
      role="application"
      aria-label={t('board')}
      aria-describedby="board-help"
    >
      <p id="board-help" className="visually-hidden">
        {t('boardHelp')}
      </p>

      <div className="board__world" style={{ transform }}>
        <ConnectionLayer
          notes={workspace.notes}
          connections={workspace.connections}
          sizes={sizes}
          selectedId={selectedConnectionId}
          onSelect={props.onSelectConnection}
          onDelete={props.onDeleteConnection}
        />

        {workspace.notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            selected={selected.has(note.id)}
            connecting={connectingFrom === note.id}
            dragging={draggingId !== null && selected.has(note.id) ? true : draggingId === note.id}
            flash={flashed.has(note.id) ? flash!.kind : null}
            handlers={handlers}
          />
        ))}
      </div>

      {marquee && <MarqueeBox marquee={marquee} />}

      {connectingFrom && (
        <div className="board-status" onPointerDown={(event) => event.stopPropagation()}>
          <span>{t('connectingHint')}</span>

          <button
            type="button"
            className="button button--small"
            onClick={() => props.onConnectingChange(null)}
          >
            {t('cancel')}
          </button>
        </div>
      )}

      {selectedConnection && !connectingFrom && (
        <div className="board-status" onPointerDown={(event) => event.stopPropagation()}>
          <span>{t('connectionSelected')}</span>

          <button
            type="button"
            className="button button--small button--danger"
            onClick={() => props.onDeleteConnection(selectedConnection.id)}
          >
            {t('delete')}
          </button>

          <button
            type="button"
            className="button button--small"
            onClick={() => props.onSelectConnection(null)}
          >
            {t('cancel')}
          </button>
        </div>
      )}
    </div>
  )
}

function toRect(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  }
}

function MarqueeBox({ marquee }: { marquee: Marquee }) {
  const rect = toRect(marquee.start, marquee.end)

  return (
    <div
      className="marquee"
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
    />
  )
}
