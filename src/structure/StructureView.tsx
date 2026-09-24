import { useEffect, useMemo, useState } from 'react'
import type { Note } from '../types'
import { CLOSED_STATUSES } from '../domain/constants'
import {
  ancestry,
  buildStructure,
  findNode,
  linkCovers,
  normalizeLinkedPath,
  notePaths,
  notesForPaths,
  type StructureNode,
} from '../domain/structure'
import { noteTitle, shortId } from '../domain/workspace'
import { statusLabel, useI18n } from '../i18n'
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
import { WEB_CODE, detectLenses, type DetectedLens, type LensKind } from '../lenses/detect'
import { buildApiModel, isDotnetFile, type ApiModel } from '../lenses/dotnet'
import { LensIcon } from '../lenses/LensIcon'
import type { LensContext, LensFocus } from '../lenses/lensContext'
import { buildDbModel, isPlsqlFile, type DbModel } from '../lenses/plsql'
import { baseName, extensionOf } from '../lenses/source'
import { WebLens } from '../lenses/WebLens'
import { buildWebModel, isWebFile, type WebModel } from '../lenses/web'
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

type LensModels = { web?: WebModel; api?: ApiModel; db?: DbModel }

/** Reads only the code a lens needs, then parses it. */
async function loadLens(kind: LensKind, files: IndexedFile[], paths: string[], lens: DetectedLens) {
  if (kind === 'web') {
    const sources = await readSources(
      files,
      (path) => WEB_CODE.has(extensionOf(path)) && isWebFile(path),
    )

    return { web: buildWebModel(paths, sources, lens.framework ?? 'react') }
  }

  if (kind === 'api') return { api: buildApiModel(await readSources(files, isDotnetFile)) }

  return { db: buildDbModel(await readSources(files, isPlsqlFile)) }
}

const EMPTY_MODELS: Record<LensKind, LensModels> = {
  web: { web: { framework: 'react', elements: [] } },
  api: { api: { resources: [], parts: [] } },
  db: { db: { tables: [], relations: [], programs: [] } },
}

const LENS_ICONS = { web: 'page', api: 'controller', db: 'table' } as const
const LENS_TITLES = { web: 'lensWeb', api: 'lensApi', db: 'lensDb' } as const

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

  useEffect(() => {
    let cancelled = false

    indexProjectFiles(root)
      .then(async (files) => {
        const paths = files.map((file) => file.path)
        const manifests = await readSources(files, (path) => baseName(path) === 'package.json')

        if (cancelled) return
        setModels({})
        setIndex({
          files,
          paths,
          truncated: files.length >= MAX_INDEXED_FILES,
          lenses: detectLenses(
            paths,
            manifests.map((manifest) => manifest.text),
          ),
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

  const detected = index && 'lenses' in index ? index.lenses : []
  const activeLens = detected.find((item) => item.kind === lens)

  // A lens reads and parses its code the first time it is opened.
  useEffect(() => {
    if (!activeLens || models[activeLens.kind] || !index || !('files' in index)) return

    let cancelled = false

    loadLens(activeLens.kind, index.files, index.paths, activeLens)
      .then((model) => {
        if (!cancelled) setModels((current) => ({ ...current, ...model }))
      })
      .catch(() => {
        // Unreadable code draws an empty lens rather than spinning forever.
        if (!cancelled) setModels((current) => ({ ...current, ...EMPTY_MODELS[activeLens.kind] }))
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

  const model = lens === 'files' ? null : models[lens]

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
          )}
        </div>

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
        {lens === 'files' ? (
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
