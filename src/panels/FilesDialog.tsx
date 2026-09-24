import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FileTreeNode, Note, SelectedFileInfo } from '../types'
import { linkCovers, normalizeLinkedPath, notePaths } from '../domain/structure'
import { noteTitle } from '../domain/workspace'
import { useI18n } from '../i18n'
import { isBoolean, usePreference } from '../preferences'
import { useProjectRoot } from '../state/projectRoot'
import {
  buildSearchTree,
  getFileInfo,
  indexProjectFiles,
  readDirectoryChildren,
  replaceTreeChildren,
  type IndexedFile,
} from '../storage/projectFiles'
import { Dialog } from '../ui/Dialog'
import { formatDate, formatFileSize } from '../ui/format'

interface FilesDialogProps {
  projectName: string
  notes: Note[]
  /** The note files can be linked to, when exactly one is selected. */
  targetNote: Note | null
  onOpenFile: (path: string) => void
  onLinkFile: (path: string) => void
  onCopyPath: (path: string) => void
  onClose: () => void
}

export function FilesDialog({
  projectName,
  notes,
  targetNote,
  onOpenFile,
  onLinkFile,
  onCopyPath,
  onClose,
}: FilesDialogProps) {
  const { t, language } = useI18n()
  const root = useProjectRoot()
  const [tree, setTree] = useState<FileTreeNode | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [index, setIndex] = useState<IndexedFile[] | null>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<SelectedFileInfo | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  // Shared with the structure view: both answer "where are my notes?".
  const [onlyNoted, setOnlyNoted] = usePreference('bruto-only-noted-files', false, isBoolean)

  // Every path a note points at, as the index writes paths.
  const linked = useMemo(
    () =>
      notes.flatMap((note) =>
        notePaths(note).map(({ path }) => ({ noteId: note.id, path: normalizeLinkedPath(path) })),
      ),
    [notes],
  )

  const notesOn = (path: string) =>
    new Set(linked.filter((link) => linkCovers(link.path, path)).map((link) => link.noteId)).size

  useEffect(() => {
    let cancelled = false

    readDirectoryChildren(root).then((children) => {
      if (!cancelled) {
        setTree({
          name: projectName,
          path: '',
          kind: 'directory',
          handle: root,
          children,
          loaded: true,
        })
      }
    })

    indexProjectFiles(root).then((files) => !cancelled && setIndex(files))

    return () => {
      cancelled = true
    }
  }, [root, projectName, refreshKey])

  const filtering = Boolean(query.trim()) || onlyNoted

  const searchTree = useMemo(() => {
    if (!filtering || !index) return null

    const files = onlyNoted
      ? index.filter((file) => linked.some((link) => linkCovers(link.path, file.path)))
      : index

    return buildSearchTree(root, projectName, files, query)
  }, [filtering, onlyNoted, index, linked, root, projectName, query])

  const toggle = useCallback(
    async (node: FileTreeNode) => {
      const isOpen = expanded.has(node.path)

      setExpanded((current) => {
        const next = new Set(current)

        if (isOpen) next.delete(node.path)
        else next.add(node.path)

        return next
      })

      if (!isOpen && !node.loaded) {
        const children = await readDirectoryChildren(
          node.handle as FileSystemDirectoryHandle,
          node.path,
        )

        setTree((current) => current && replaceTreeChildren(current, node.path, children))
      }
    },
    [expanded],
  )

  const select = async (node: FileTreeNode) => {
    setSelected(await getFileInfo(root, node.path).catch(() => null))
  }

  const shown = searchTree ?? tree
  const alreadyLinked = Boolean(selected && targetNote?.filePaths.includes(selected.path))

  const renderNode = (node: FileTreeNode, depth: number) => {
    if (node.kind === 'file') {
      const count = notesOn(node.path)

      return (
        <li key={node.path}>
          <button
            type="button"
            className={`file-tree__row ${selected?.path === node.path ? 'is-selected' : ''}`}
            style={{ paddingLeft: 12 + depth * 16 }}
            onClick={() => select(node)}
            onDoubleClick={() => onOpenFile(node.path)}
          >
            <span className="file-tree__icon" aria-hidden="true">
              ·
            </span>
            {node.name}
            {count > 0 && (
              <span className="file-tree__notes" title={t('notesCount', { count })}>
                <span aria-hidden="true">{count}</span>
                <span className="visually-hidden">{t('notesCount', { count })}</span>
              </span>
            )}
          </button>
        </li>
      )
    }

    const open = filtering || expanded.has(node.path)

    return (
      <li key={node.path}>
        <button
          type="button"
          className="file-tree__row file-tree__row--directory"
          style={{ paddingLeft: 12 + depth * 16 }}
          aria-expanded={open}
          onClick={() => !filtering && toggle(node)}
        >
          <span className="file-tree__icon" aria-hidden="true">
            {open ? '▾' : '▸'}
          </span>
          {node.name}/
        </button>

        {open && node.children && node.children.length > 0 && (
          <ul>{node.children.map((child) => renderNode(child, depth + 1))}</ul>
        )}
      </li>
    )
  }

  return (
    <Dialog
      size="large"
      eyebrow={t('files')}
      title={projectName}
      description={t('filesDescription')}
      onClose={onClose}
    >
      <div className="files-dialog">
        <div className="files-dialog__toolbar">
          <label className="visually-hidden" htmlFor="file-search">
            {t('searchFiles')}
          </label>
          <input
            id="file-search"
            type="search"
            className="input"
            placeholder={t('searchFiles')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            data-autofocus
          />
          <button
            type="button"
            className="button button--toggle"
            aria-pressed={onlyNoted}
            onClick={() => setOnlyNoted(!onlyNoted)}
          >
            {t('onlyWithNotes')}
          </button>
          <button type="button" className="button" onClick={() => setRefreshKey((key) => key + 1)}>
            {t('refresh')}
          </button>
        </div>

        <div className="files-dialog__columns">
          <div className="file-tree" aria-busy={!shown}>
            {!shown || (filtering && !index) ? (
              <p className="empty-text">{filtering ? t('indexingFiles') : t('loading')}</p>
            ) : shown.children?.length ? (
              <ul>{shown.children.map((child) => renderNode(child, 0))}</ul>
            ) : (
              <p className="empty-text">
                {onlyNoted && !query.trim() ? t('onlyWithNotesEmpty') : t('noFilesFound')}
              </p>
            )}
          </div>

          <aside className="file-info" aria-live="polite">
            {!selected ? (
              <p className="empty-text">{t('selectFileHint')}</p>
            ) : (
              <>
                <h3 className="file-info__name">{selected.name}</h3>

                <dl className="file-info__list">
                  <dt>{t('path')}</dt>
                  <dd>{selected.path}</dd>
                  <dt>{t('size')}</dt>
                  <dd>{formatFileSize(selected.size)}</dd>
                  <dt>{t('modified')}</dt>
                  <dd>{formatDate(language, selected.lastModified, true)}</dd>
                  <dt>{t('fileType')}</dt>
                  <dd>{selected.type}</dd>
                </dl>

                <div className="button-stack">
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => onOpenFile(selected.path)}
                  >
                    {t('openFile')}
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={() => onCopyPath(selected.path)}
                  >
                    {t('copyPath')}
                  </button>
                  {targetNote && (
                    <button
                      type="button"
                      className="button"
                      disabled={alreadyLinked}
                      onClick={() => onLinkFile(selected.path)}
                    >
                      {alreadyLinked
                        ? t('fileAlreadyLinked')
                        : t('linkToNote', { title: noteTitle(targetNote, t('untitled')) })}
                    </button>
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </Dialog>
  )
}
