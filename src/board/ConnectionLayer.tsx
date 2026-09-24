import { memo, useMemo } from 'react'
import type { Connection, Note } from '../types'
import { noteTitle } from '../domain/workspace'
import { useI18n } from '../i18n'
import { connectionPath, hasReverse, noteRect, type NoteSizes } from './geometry'

interface ConnectionLayerProps {
  notes: Note[]
  connections: Connection[]
  sizes: NoteSizes
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

export const ConnectionLayer = memo(function ConnectionLayer({
  notes,
  connections,
  sizes,
  selectedId,
  onSelect,
  onDelete,
}: ConnectionLayerProps) {
  const { t } = useI18n()
  const notesById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes])

  return (
    <svg className="connections" aria-label={t('connections')}>
      <defs>
        <marker
          id="connection-arrow"
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

      {connections.map((connection) => {
        const from = notesById.get(connection.from)
        const to = notesById.get(connection.to)

        if (!from || !to) return null

        const path = connectionPath(
          noteRect(from, sizes),
          noteRect(to, sizes),
          hasReverse(connection, connections),
        )

        const selected = connection.id === selectedId

        return (
          <g key={connection.id} className={`connection ${selected ? 'is-selected' : ''}`}>
            <path className="connection__line" d={path} markerEnd="url(#connection-arrow)" />

            <path
              className="connection__hitbox"
              d={path}
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              aria-label={t('connectionLabel', {
                from: noteTitle(from, t('untitled')),
                to: noteTitle(to, t('untitled')),
              })}
              onPointerDown={(event) => {
                event.stopPropagation()

                if (event.button === 1) {
                  event.preventDefault()
                  onDelete(connection.id)
                } else if (event.button === 0) {
                  onSelect(connection.id)
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(connection.id)
                } else if (event.key === 'Delete' || event.key === 'Backspace') {
                  event.preventDefault()
                  event.stopPropagation()
                  onDelete(connection.id)
                }
              }}
            />
          </g>
        )
      })}
    </svg>
  )
})
