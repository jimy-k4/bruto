import type { Connection, Note } from '../types'
import { getConnectionPath, getNoteRenderedSize } from '../lib/connectionGeometry'

export function ConnectionLayer({
  notes,
  connections,
  selectedConnectionId,
  onSelectConnection,
  onDeleteConnection,
  zoom,
  pan,
}: {
  notes: Note[]
  connections: Connection[]
  selectedConnectionId: string | null
  onSelectConnection: (connectionId: string) => void
  onDeleteConnection: (connectionId: string) => void
  zoom: number
  pan: {
    x: number
    y: number
  }
}) {
  const curveOffset = 40

  return (
    <div
      className="connection-world"
      style={{
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
      }}
    >
      <svg className="connection-layer" aria-hidden="false">
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
          const fromNote = notes.find((note) => note.id === connection.from)

          const toNote = notes.find((note) => note.id === connection.to)

          if (!fromNote || !toNote) {
            return null
          }

          const sizes = {
            from: getNoteRenderedSize(fromNote),
            to: getNoteRenderedSize(toNote),
          }

          const path = getConnectionPath(
            connection,
            fromNote,
            toNote,
            sizes,
            curveOffset,
            connections,
          )

          const isSelected = selectedConnectionId === connection.id

          return (
            <g
              key={connection.id}
              className={isSelected ? 'connection-group connection-selected' : 'connection-group'}
            >
              <path
                d={path}
                className="connection-hitbox"
                onMouseDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()

                  if (event.button === 1) {
                    onDeleteConnection(connection.id)

                    return
                  }

                  if (event.button === 0) {
                    onSelectConnection(connection.id)
                  }
                }}
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                }}
              />

              <path d={path} className="connection-line" markerEnd="url(#connection-arrow)" />
            </g>
          )
        })}
      </svg>
    </div>
  )
}
