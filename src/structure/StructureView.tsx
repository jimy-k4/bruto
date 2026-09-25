import { useEffect, useMemo, useState } from 'react'
import type { Note } from '../types'
import { CLOSED_STATUSES } from '../domain/constants'
import {
  ancestry,
  buildStructure,
  findNode,
  keepNoted,
  linkCovers,
  normalizeLinkedPath,
  notePaths,
  notesForPaths,
  type StructureNode,
} from '../domain/structure'
import { noteTitle, shortId } from '../domain/workspace'
import { statusLabel, useI18n } from '../i18n'
import { isBoolean, usePreference } from '../preferences'
import { useProjectRoot } from '../state/projectRoot'
import {
  IGNORED_DIRECTORIES,
  MAX_INDEXED_FILES,
  indexProjectFiles,
  readSources,
  type IndexedFile,
} from '../storage/projectFiles'
import { ApiLens } from '../lenses/ApiLens'
import { DbLens } from '../lenses/DbLens'
import { detectLenses, detectionFiles, type DetectedLens, type LensKind } from '../lenses/detect'
import type { ApiModel } from '../lenses/dotnet'
import { keepNotedModel } from '../lenses/keepNoted'
import { LensIcon } from '../lenses/LensIcon'
import type { LensContext, LensFocus } from '../lenses/lensContext'
import { emptyModel, loadLens, type LensModel } from '../lenses/load'
import type { DbModel } from '../lenses/sql'
import { WebLens } from '../lenses/WebLens'
import type { WebModel } from '../lenses/web'
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

type Index =
  | { files: IndexedFile[]; paths: string[]; truncated: boolean; lenses: DetectedLens[] }
  | { error: string }
  | null

type Lens = 'files' | LensKind

type LensModels = Partial<Record<LensKind, LensModel>>

const LENS_ICONS = { web: 'page', api: 'controller', db: 'table' } as const
const LENS_TITLES = { web: 'lensWeb', api: 'lensApi', db: 'lensDb' } as const

const isEmptyModel = (model: WebModel | ApiModel | DbModel) =>
  'elements' in model
    ? model.elements.length === 0
    : 'resources' in model
      ? model.resources.length === 0 && model.parts.length === 0
      : model.tables.length === 0 && model.programs.length === 0

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
  const [lens, setLens] = useState<Lens>('files')
  const [models, setModels] = useState<LensModels>({})
  const [lensFocus, setLensFocus] = useState<LensFocus | null>(null)
  // Shared with the files window: both answer "where are my notes?".
  const [onlyNoted, setOnlyNoted] = usePreference('bruto-only-noted-files', false, isBoolean)

  useEffect(() => {
    let cancelled = false

    indexProjectFiles(root)
      .then(async (files) => {
        const paths = files.map((file) => file.path)
        const samples = await readSources(files, detectionFiles())

        if (cancelled) return
        setModels({})
        setIndex({
          files,
          paths,
          truncated: files.length >= MAX_INDEXED_FILES,
          lenses: detectLenses(paths, samples),
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

  // The map drawn: everything, or only what notes point at.
  const mapRoot = useMemo(
    () => structure && (onlyNoted ? keepNoted(structure.root) : structure.root),
    [structure, onlyNoted],
  )

  const notesById = useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes])

  const detected = index && 'lenses' in index ? index.lenses : []
  const activeLens = detected.find((item) => item.kind === lens)

  // A lens reads and parses its code the first time it is opened.
  useEffect(() => {
    if (!activeLens || models[activeLens.kind] || !index || !('files' in index)) return

    let cancelled = false

    const kind = activeLens.kind

    loadLens(activeLens, index.files, index.paths)
      // Unreadable code draws an empty lens rather than spinning forever.
      .catch(() => emptyModel(activeLens))
      .then((model) => {
        if (!cancelled) setModels((current) => ({ ...current, [kind]: model }))
      })

    return () => {
      cancelled = true
    }
  }, [activeLens, models, index])

  // Paths linked by the notes selected on the board, as the map highlights them.
  const highlighted = useMemo(
    () =>
      notes
        .filter((note) => selectedIds.includes(note.id))
        .flatMap((note) => notePaths(note).map(({ path }) => normalizeLinkedPath(path)))
        .filter(Boolean),
    [notes, selectedIds],
  )

  if (!index || !structure || !mapRoot) {
    return (
      <section className="structure" aria-label={t('structure')} aria-busy={!index}>
        <p className="structure__message">
          {index && 'error' in index ? index.error : t('structureLoading')}
        </p>
      </section>
    )
  }

  const truncated = 'truncated' in index && index.truncated
  const folder = findNode(mapRoot, folderPath)
  const focus = focusPath === null ? folder : findNode(mapRoot, focusPath)
  const broken = truncated ? [] : structure.broken.filter((link) => isIndexable(link.path))
  const anyLinks = notes.some((note) => notePaths(note).length > 0)

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

  const chooseLens = (next: Lens) => {
    setLens(next)
    setLensFocus(null)
  }

  // What the side list is about: a place on the file map, or an element of a lens.
  const place =
    lens === 'files'
      ? {
          label: focus.path || projectName,
          notes: [...focus.noteIds]
            .map((id) => notesById.get(id))
            .filter((note): note is Note => Boolean(note)),
          covers: (linked: string) =>
            !focus.path || linkCovers(linked, focus.path) || linkCovers(focus.path, linked),
        }
      : lensFocus
        ? {
            label: lensFocus.label,
            notes: notesForPaths(notes, lensFocus.paths),
            covers: (linked: string) => lensFocus.paths.some((path) => linkCovers(linked, path)),
          }
        : null

  const placeNotes = place ? [...place.notes].sort(byUrgency) : []

  // Paths shown under a note: only those inside the place being looked at.
  const pathsInside = (note: Note) =>
    notePaths(note).filter(({ path }) => place?.covers(normalizeLinkedPath(path)))

  const context: LensContext = {
    notesFor: (paths) => notesForPaths(notes, paths),
    linked: (paths) => highlighted.some((linked) => paths.some((path) => linkCovers(linked, path))),
    focusKey: lensFocus?.key ?? null,
    onFocus: (next) => setLensFocus((current) => (current?.key === next.key ? null : next)),
  }

  const loaded = lens === 'files' ? null : models[lens]
  const model =
    loaded && onlyNoted
      ? keepNotedModel(loaded, (paths) => notesForPaths(notes, paths).length > 0)
      : loaded
  // With the filter on and no note pointing anywhere in this view, say so rather than draw nothing.
  const nothingNoted =
    onlyNoted && (lens === 'files' ? mapRoot.children.length === 0 : !!model && isEmptyModel(model))

  return (
    <section className="structure" aria-label={t('structure')}>
      <header className="structure__bar">
        <div className="structure__lead">
          {detected.length > 0 && (
            <div className="structure__lenses" role="group" aria-label={t('lenses')}>
              <button
                type="button"
                className="structure__lens"
                aria-pressed={lens === 'files'}
                onClick={() => chooseLens('files')}
              >
                <LensIcon name="other" />
                {t('lensFiles')}
              </button>
              {detected.map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  className="structure__lens"
                  aria-pressed={lens === item.kind}
                  onClick={() => chooseLens(item.kind)}
                >
                  <LensIcon name={LENS_ICONS[item.kind]} />
                  {t(LENS_TITLES[item.kind])}
                  <span className="structure__lens-tech">{item.tech}</span>
                </button>
              ))}
            </div>
          )}

          {lens === 'files' && (
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
                {ancestry(mapRoot, folder.path).map((node, position, chain) => (
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
          )}
        </div>

        <div className="structure__actions">
          <button
            type="button"
            className="button button--small button--toggle"
            aria-pressed={onlyNoted}
            onClick={() => setOnlyNoted(!onlyNoted)}
          >
            {t('onlyWithNotes')}
          </button>
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
        {nothingNoted ? (
          <p className="structure__message">{t('onlyWithNotesEmpty')}</p>
        ) : lens === 'files' ? (
          <StructureMap
            folder={folder}
            focusPath={focus === folder ? null : focus.path}
            highlighted={highlighted}
            notesById={notesById}
            onOpen={open}
            onUp={up}
          />
        ) : !model ? (
          <p className="structure__message" aria-busy="true">
            {t('lensLoading')}
          </p>
        ) : 'elements' in model ? (
          <WebLens model={model} context={context} />
        ) : 'resources' in model ? (
          <ApiLens model={model} context={context} />
        ) : (
          <DbLens model={model} context={context} />
        )}

        <aside className="structure__side" aria-label={t('structureNotes')}>
          {truncated && (
            <p className="structure__warning">
              {t('structureTruncated', { count: MAX_INDEXED_FILES })}
            </p>
          )}

          <section className="structure__section">
            <h2 className="eyebrow">{t('structureNotesIn')}</h2>

            {!place ? (
              <p className="field__hint">{t('lensPickHint')}</p>
            ) : (
              <>
                <p className="structure__place">{place.label}</p>

                {placeNotes.length === 0 ? (
                  <p className="field__hint">
                    {anyLinks ? t('structureNoNotes') : t('structureNoLinks')}
                  </p>
                ) : (
                  <ul className="structure__notes">
                    {placeNotes.map((note) => (
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
                          {pathsInside(note).map(({ path, byAi }) => (
                            <span key={`${byAi}:${path}`} className="structure-note__path">
                              {byAi && <AiTag />}
                              {path}
                            </span>
                          ))}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
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
                      <li key={`${link.noteId}:${link.byAi}:${link.path}`}>
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
                            {link.byAi && <AiTag />}
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

/** Marks a path the AI wrote down, as opposed to one the user linked. */
function AiTag() {
  const { t } = useI18n()

  return (
    <abbr className="ai-tag" title={t('aiFiles')}>
      AI
    </abbr>
  )
}
