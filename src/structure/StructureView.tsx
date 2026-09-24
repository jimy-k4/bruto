import { useEffect, useMemo, useState } from 'react'
import type { Note } from '../types'
import { CLOSED_STATUSES } from '../domain/constants'
import {
  ancestry,
  buildStructure,
  findNode,
  normalizeLinkedPath,
  type StructureNode,
} from '../domain/structure'
import { noteTitle, shortId } from '../domain/workspace'
import { statusLabel, useI18n } from '../i18n'
import { useProjectRoot } from '../state/projectRoot'
import { IGNORED_DIRECTORIES, MAX_INDEXED_FILES, indexProjectFiles } from '../storage/projectFiles'
import { StructureMap } from './StructureMap'

interface StructureViewProps {
  projectName: string
  notes: Note[]
  /** Notes selected on the board: their files stand out on the map. */
  selectedIds: string[]
  onShowNote: (id: string) => void
  onEditNote: (id: string) => void
  onClose: () => void
}

type Index = { paths: string[]; truncated: boolean } | { error: string } | null

/** Paths inside folders Bruto never indexes can't be checked, so they aren't "broken". */
const isIndexable = (path: string) =>
  normalizeLinkedPath(path)
    .split('/')
    .every((part) => !IGNORED_DIRECTORIES.has(part))

/** Open work first, then by position on the board. */
const byUrgency = (a: Note, b: Note) => {
  const closed = (note: Note) => Boolean(note.status && CLOSED_STATUSES.includes(note.status))

  return Number(closed(a)) - Number(closed(b)) || a.y - b.y || a.x - b.x
}

/**
 * The project's folders and files as blocks sized by how many files they hold,
 * with the notes that point at them. Shows where the work is.
 */
export function StructureView({
  projectName,
  notes,
  selectedIds,
  onShowNote,
  onEditNote,
  onClose,
}: StructureViewProps) {
  const { t } = useI18n()
  const root = useProjectRoot()
  const [index, setIndex] = useState<Index>(null)
  const [reloads, setReloads] = useState(0)
  const [folderPath, setFolderPath] = useState('')
  const [focusPath, setFocusPath] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    indexProjectFiles(root)
      .then((files) => {
        if (cancelled) return
        setIndex({
          paths: files.map((file) => file.path),
          truncated: files.length >= MAX_INDEXED_FILES,
        })
      })
      .catch((error: unknown) => {
        if (!cancelled) setIndex({ error: error instanceof Error ? error.message : String(error) })
      })

    return () => {
      cancelled = true
    }
  }, [root, reloads])

  const structure = useMemo(
    () => (index && 'paths' in index ? buildStructure(projectName, index.paths, notes) : null),
    [index, projectName, notes],
  )

  const notesById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes])

  // Paths linked by the notes selected on the board, as the map highlights them.
  const highlighted = useMemo(
    () =>
      notes
        .filter((note) => selectedIds.includes(note.id))
        .flatMap((note) => note.filePaths.map(normalizeLinkedPath))
        .filter(Boolean),
    [notes, selectedIds],
  )

  if (!index || !structure) {
    return (
      <section className="structure" aria-label={t('structure')} aria-busy={!index}>
        <p className="structure__message">
          {index && 'error' in index ? index.error : t('structureLoading')}
        </p>
      </section>
    )
  }

  const truncated = 'truncated' in index && index.truncated
  const folder = findNode(structure.root, folderPath)
  const focus = focusPath === null ? folder : findNode(structure.root, focusPath)
  const focusNotes = [...focus.noteIds]
    .map((id) => notesById.get(id))
    .filter((note): note is Note => Boolean(note))
    .sort(byUrgency)
  const broken = truncated ? [] : structure.broken.filter((link) => isIndexable(link.path))
  const anyLinks = notes.some((note) => note.filePaths.length > 0)

  const open = (node: StructureNode) => {
    if (node.kind === 'directory') {
      setFolderPath(node.path)
      setFocusPath(null)
    } else {
      setFocusPath(focusPath === node.path ? null : node.path)
    }
  }

  const up = () => {
    if (!folder.path) return
    setFolderPath(folder.path.split('/').slice(0, -1).join('/'))
    setFocusPath(null)
  }

  // Paths shown under a note: only those inside the place being looked at.
  const pathsInside = (note: Note) =>
    note.filePaths.filter((path) => {
      const normalized = normalizeLinkedPath(path)

      return (
        !focus.path ||
        normalized === focus.path ||
        normalized.startsWith(`${focus.path}/`) ||
        focus.path.startsWith(`${normalized}/`)
      )
    })

  return (
    <section className="structure" aria-label={t('structure')}>
      <header className="structure__bar">
        <nav className="structure__crumbs" aria-label={t('structurePath')}>
          <button
            type="button"
            className="structure__up"
            onClick={up}
            disabled={!folder.path}
            aria-label={t('structureUp')}
            title={`${t('structureUp')} (Backspace)`}
          >
            ↑
          </button>

          <ol>
            {ancestry(structure.root, folder.path).map((node, position, chain) => (
              <li key={node.path}>
                <button
                  type="button"
                  aria-current={position === chain.length - 1 ? 'location' : undefined}
                  onClick={() => {
                    setFolderPath(node.path)
                    setFocusPath(null)
                  }}
                >
                  {node.name}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="structure__actions">
          <button
            type="button"
            className="button button--small"
            onClick={() => setReloads((count) => count + 1)}
          >
            {t('structureRefresh')}
          </button>
          <button type="button" className="button button--small" onClick={onClose}>
            {t('backToBoard')} <kbd>Esc</kbd>
          </button>
        </div>
      </header>

      <div className="structure__body">
        <StructureMap
          folder={folder}
          focusPath={focus === folder ? null : focus.path}
          highlighted={highlighted}
          notesById={notesById}
          onOpen={open}
          onUp={up}
        />

        <aside className="structure__side" aria-label={t('structureNotes')}>
          {truncated && (
            <p className="structure__warning">
              {t('structureTruncated', { count: MAX_INDEXED_FILES })}
            </p>
          )}

          <section className="structure__section">
            <h2 className="eyebrow">{t('structureNotesIn')}</h2>
            <p className="structure__place">{focus.path || projectName}</p>

            {focusNotes.length === 0 ? (
              <p className="field__hint">
                {anyLinks ? t('structureNoNotes') : t('structureNoLinks')}
              </p>
            ) : (
              <ul className="structure__notes">
                {focusNotes.map((note) => (
                  <li key={note.id}>
                    <button
                      type="button"
                      className="structure-note"
                      onClick={() => onShowNote(note.id)}
                      title={t('showOnBoard')}
                    >
                      <span className="structure-note__head">
                        <span className="note__id">{shortId(note.id)}</span>
                        {note.status && (
                          <span className={`status-badge status-badge--${note.status}`}>
                            {statusLabel(t, note.status)}
                          </span>
                        )}
                      </span>
                      <span className="structure-note__title">
                        {noteTitle(note, t('untitled'))}
                      </span>
                      {pathsInside(note).map((path) => (
                        <span key={path} className="structure-note__path">
                          {path}
                        </span>
                      ))}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {broken.length > 0 && (
            <section className="structure__section">
              <h2 className="eyebrow">{t('brokenLinks', { count: broken.length })}</h2>
              <p className="field__hint">{t('brokenLinksHint')}</p>

              <ul className="structure__notes">
                {broken.map((link) => {
                  const note = notesById.get(link.noteId)

                  return (
                    note && (
                      <li key={`${link.noteId}:${link.path}`}>
                        <button
                          type="button"
                          className="structure-note structure-note--broken"
                          onClick={() => onEditNote(note.id)}
                          title={t('edit')}
                        >
                          <span className="structure-note__head">
                            <span className="note__id">{shortId(note.id)}</span>
                          </span>
                          <span className="structure-note__title">
                            {noteTitle(note, t('untitled'))}
                          </span>
                          <span className="structure-note__path">
                            <del>{link.path}</del>
                          </span>
                        </button>
                      </li>
                    )
                  )
                })}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </section>
  )
}
