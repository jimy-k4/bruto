import { useEffect, useRef, useState } from 'react'
import type { Note } from '../types'
import type { StructureNode } from '../domain/structure'
import { useI18n } from '../i18n'
import { squarify } from './treemap'

interface StructureMapProps {
  folder: StructureNode
  /** The file picked inside `folder`, if any. */
  focusPath: string | null
  /** Paths linked by the notes selected on the board. */
  highlighted: string[]
  notesById: Map<string, Note>
  onOpen: (node: StructureNode) => void
  onUp: () => void
}

/** Past this, the smallest entries of a folder share one block: tiny blocks say nothing. */
const MAX_BLOCKS = 48
/** Status marks per block before "+N". */
const MAX_MARKS = 12
/** Mortar between blocks, in pixels. */
const GAP = 6

/** Big folder blocks show their contents in miniature. Insets match `.structure-block__plan` plus the borders. */
const PLAN_MIN_WIDTH = 200
const PLAN_MIN_HEIGHT = 170
const PLAN_INSET_X = 32
const PLAN_INSET_Y = 118

type Block = { kind: 'node'; node: StructureNode } | { kind: 'rest'; count: number; files: number }

const contains = (outer: string, inner: string) =>
  outer === inner || inner.startsWith(`${outer}/`) || outer === ''

const extension = (name: string) => {
  const dot = name.lastIndexOf('.')

  return dot > 0 ? name.slice(dot + 1).toUpperCase() : '—'
}

function blocksOf(folder: StructureNode): Block[] {
  const nodes = folder.children

  if (nodes.length <= MAX_BLOCKS) return nodes.map((node) => ({ kind: 'node', node }))

  const rest = nodes.slice(MAX_BLOCKS - 1)

  return [
    ...nodes.slice(0, MAX_BLOCKS - 1).map((node): Block => ({ kind: 'node', node })),
    {
      kind: 'rest',
      count: rest.length,
      files: rest.reduce((sum, node) => sum + node.fileCount, 0),
    },
  ]
}

/** The current folder as a treemap: one concrete block per entry, sized by files. */
export function StructureMap({
  folder,
  focusPath,
  highlighted,
  notesById,
  onOpen,
  onUp,
}: StructureMapProps) {
  const { t } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current

    if (!element) return

    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    )

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  const placed = squarify(
    blocksOf(folder).map((block) => ({
      item: block,
      weight: block.kind === 'node' ? block.node.fileCount : block.files,
    })),
    { x: 0, y: 0, ...size },
  )

  return (
    <div
      ref={ref}
      className="structure-map"
      role="group"
      aria-label={t('structureMap')}
      onKeyDown={(event) => {
        if (event.key === 'Backspace') {
          event.preventDefault()
          onUp()
        }
      }}
    >
      {folder.children.length === 0 && <p className="structure__message">{t('structureEmpty')}</p>}

      {placed.map(({ item, box }) => {
        const width = Math.max(0, box.width - GAP)
        const height = Math.max(0, box.height - GAP)
        const scale =
          width < 72 || height < 40 ? 'is-tiny' : width < 150 || height < 84 ? 'is-small' : ''
        const style = { left: box.x + GAP / 2, top: box.y + GAP / 2, width, height }

        if (item.kind === 'rest') {
          return (
            <div
              key="rest"
              className={`structure-block structure-block--rest ${scale}`}
              style={style}
              title={t('structureRest', { count: item.count })}
            >
              <span className="structure-block__name">+{item.count}</span>
            </div>
          )
        }

        const { node } = item
        const isFolder = node.kind === 'directory'
        const linked = [...node.noteIds]
          .map((id) => notesById.get(id))
          .filter((note): note is Note => Boolean(note))
        const classes = [
          'structure-block',
          isFolder ? 'structure-block--folder' : 'structure-block--file',
          linked.length > 0 && 'has-notes',
          focusPath === node.path && 'is-focused',
          highlighted.some((path) => contains(node.path, path) || contains(path, node.path)) &&
            'is-linked',
          scale,
        ]
        const files = isFolder ? t('filesCount', { count: node.fileCount }) : null
        const notesText = linked.length > 0 ? t('notesCount', { count: linked.length }) : null

        return (
          <button
            key={node.path}
            type="button"
            className={classes.filter(Boolean).join(' ')}
            style={style}
            onClick={() => onOpen(node)}
            aria-label={[node.name, files, notesText].filter(Boolean).join(', ')}
            aria-pressed={isFolder ? undefined : focusPath === node.path}
            title={node.path}
          >
            <span className="structure-block__kind" aria-hidden="true">
              {isFolder ? t('folderTag') : extension(node.name)}
            </span>
            <span className="structure-block__name" aria-hidden="true">
              {node.name}
            </span>
            <span className="structure-block__meta" aria-hidden="true">
              {[files, notesText].filter(Boolean).join(' · ')}
            </span>

            {isFolder && width >= PLAN_MIN_WIDTH && height >= PLAN_MIN_HEIGHT && (
              <FolderPlan
                folder={node}
                width={width - PLAN_INSET_X}
                height={height - PLAN_INSET_Y}
              />
            )}

            {linked.length > 0 && (
              <span className="structure-block__marks" aria-hidden="true">
                {linked.slice(0, MAX_MARKS).map((note) => (
                  <span
                    key={note.id}
                    className={`structure-block__mark status-badge--${note.status ?? 'none'}`}
                  />
                ))}
                {linked.length > MAX_MARKS && <span>+{linked.length - MAX_MARKS}</span>}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** A folder's contents drawn small inside its block: where its files and its notes are. */
function FolderPlan({
  folder,
  width,
  height,
}: {
  folder: StructureNode
  width: number
  height: number
}) {
  const placed = squarify(
    blocksOf(folder).map((block) => ({
      item: block,
      weight: block.kind === 'node' ? block.node.fileCount : block.files,
    })),
    { x: 0, y: 0, width, height },
  )

  return (
    <span className="structure-block__plan" aria-hidden="true">
      {placed.map(({ item, box }) => (
        <span
          key={item.kind === 'node' ? item.node.path : 'rest'}
          className={item.kind === 'node' && item.node.noteIds.size > 0 ? 'has-notes' : undefined}
          style={{
            left: box.x + 1,
            top: box.y + 1,
            width: Math.max(0, box.width - 2),
            height: Math.max(0, box.height - 2),
          }}
        />
      ))}
    </span>
  )
}
