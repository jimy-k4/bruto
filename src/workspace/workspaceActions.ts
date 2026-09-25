import type {
  ContextScope,
  NoteStatus,
  Point,
  StatusStyleConfig,
  Workspace,
  WorkspaceDocumentation,
} from '../types'
import { buildAiContext, estimateTokens, getContextNoteIds } from '../domain/aiContext'
import { copyNotes, pasteNotes } from '../domain/clipboard'
import { NOTE_MIN_SIZE } from '../domain/constants'
import {
  addConnection,
  createNote,
  deleteNotes,
  duplicateNotes,
  findNote,
  moveNotes,
  noteTitle,
  raiseNotes,
  removeConnection,
  removeDocumentation,
  replaceStatusStyles,
  setStatusStyle,
  updateNotes,
  upsertDocumentation,
  type NotePatch,
} from '../domain/workspace'
import { boundingRect, noteRect, type NoteSizes } from '../board/geometry'
import type { BoardViewApi } from '../board/useBoardView'
import type { Translate } from '../i18n'
import type { ActiveProject } from '../state/useProjects'
import type { useNoteClipboard } from '../state/useNoteClipboard'
import {
  getRelativePath,
  isImageFile,
  openProjectFile,
  saveNoteImage,
} from '../storage/projectFiles'
import { ensureAccess } from '../storage/recentProjects'
import { readWorkspaceFile } from '../storage/workspaceFile'
import type { ShowToast } from '../ui/toasts'
import type { WorkspaceUi } from './useWorkspaceUi'

interface Dependencies {
  project: ActiveProject
  ui: WorkspaceUi
  view: BoardViewApi
  sizes: NoteSizes
  clipboard: ReturnType<typeof useNoteClipboard>
  toast: ShowToast
  t: Translate
}

/** Every change the user can make to the workspace, with its feedback. */
export function createWorkspaceActions({
  project,
  ui,
  view,
  sizes,
  clipboard,
  toast,
  t,
}: Dependencies) {
  const { store, sync, handle: root } = project
  const current = () => store.getWorkspace()

  const fail = (error: unknown, fallback: string) => {
    console.error(error)
    toast({ tone: 'error', message: fallback })
  }

  const writeClipboardText = async (text: string, success: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ tone: 'success', message: success })
      return true
    } catch (error) {
      fail(error, t('clipboardFailed'))
      return false
    }
  }

  /** Says what a copy for the AI holds, so Q, W and E can be told apart. */
  const describeContextCopy = (scope: ContextScope, ids: string[], text: string) => {
    const workspace = current()
    const count = getContextNoteIds(workspace, scope, ids).size
    const tokens = estimateTokens(text).toLocaleString()

    if (scope === 'entire') return t('contextCopiedEntire', { count, tokens })

    if (scope === 'connected') {
      return count > ids.length
        ? t('contextCopiedConnected', { count, tokens })
        : t('contextCopiedNoConnections', { tokens })
    }

    const note = ids.length === 1 ? findNote(workspace, ids[0]) : undefined

    if (!note) return t('contextCopiedSelection', { count, tokens })

    const title = noteTitle(note, t('untitled'))

    return t('contextCopiedNote', {
      title: title.length > 40 ? `${title.slice(0, 39)}…` : title,
      tokens,
    })
  }

  /** A free spot in the middle of the screen, so new notes never land off-screen. */
  const freeSpotAtCenter = (): Point => {
    const center = view.visibleCenter()
    const spot = { x: center.x - NOTE_MIN_SIZE.width / 2, y: center.y - NOTE_MIN_SIZE.height / 2 }
    const taken = (point: Point) =>
      current().notes.some(
        (note) => Math.abs(note.x - point.x) < 12 && Math.abs(note.y - point.y) < 12,
      )

    while (taken(spot)) {
      spot.x += 24
      spot.y += 24
    }

    return spot
  }

  const actions = {
    // Notes ----------------------------------------------------------------

    createNote(): string {
      const { workspace, note } = createNote(current(), freeSpotAtCenter(), t('newNoteTitle'))

      store.update(() => workspace)
      ui.select([note.id], { open: true, focusEditor: true })

      return note.id
    },

    updateNote(id: string, patch: NotePatch) {
      // One undo step per editing session of a note.
      store.update((workspace) => updateNotes(workspace, [id], patch), { group: `note:${id}` })
    },

    updateNotes(ids: string[], patch: NotePatch) {
      store.update((workspace) => updateNotes(workspace, ids, patch))
    },

    deleteNotes(ids: string[]) {
      if (ids.length === 0) return

      store.update((workspace) => deleteNotes(workspace, ids))
      ui.clearSelection()
      toast({
        message: t('notesDeleted', { count: ids.length }),
        action: { label: t('undo'), run: () => store.undo() },
      })
    },

    duplicate(ids: string[]) {
      if (ids.length === 0) return

      const result = duplicateNotes(current(), ids, t('copySuffix'))

      store.update(() => result.workspace)
      ui.select(result.ids)
    },

    raise(ids: string[]) {
      store.update((workspace) => raiseNotes(workspace, ids), { history: false })
    },

    move(positions: Map<string, Point>) {
      store.update((workspace) => moveNotes(workspace, positions), { group: 'drag' })
    },

    endMove() {
      store.endGroup()
    },

    moveBy(ids: string[], delta: Point) {
      const positions = new Map(
        current()
          .notes.filter((note) => ids.includes(note.id))
          .map((note) => [note.id, { x: note.x + delta.x, y: note.y + delta.y }]),
      )

      store.update((workspace) => moveNotes(workspace, positions), { group: 'keyboard-move' })
    },

    // Connections ------------------------------------------------------------

    connect(from: string, to: string) {
      store.update((workspace) => addConnection(workspace, from, to))
    },

    deleteConnection(id: string) {
      store.update((workspace) => removeConnection(workspace, id))
      ui.setSelectedConnectionId(null)
    },

    // Clipboard --------------------------------------------------------------

    /** Ctrl+C: keeps the notes for Ctrl+V and returns their Markdown for other apps. */
    copyNotes(ids: string[]): string | null {
      const copied = copyNotes(current(), ids)

      if (!copied) return null

      clipboard.save(copied)
      ui.flashNotes(ids, 'copied')
      toast({ message: t('notesCopied', { count: ids.length }) })

      return buildAiContext(current(), 'current', ids)
    },

    pasteNotes() {
      if (!clipboard.clipboard) {
        toast({ message: t('nothingToPaste') })
        return
      }

      const result = pasteNotes(
        current(),
        clipboard.clipboard,
        view.visibleCenter(),
        t('copySuffix'),
      )

      store.update(() => result.workspace)
      ui.select(result.ids)
      ui.flashNotes(result.ids, 'pasted')
    },

    async copyContext(scope: ContextScope, text?: string) {
      const ids = ui.selectedIds

      if (scope !== 'entire' && ids.length === 0) {
        toast({ message: t('selectNoteFirst') })
        return
      }

      const content = text ?? buildAiContext(current(), scope, ids)
      const copied = await writeClipboardText(content, describeContextCopy(scope, ids, content))

      if (copied) ui.markCopied(scope)
    },

    // Files and images ---------------------------------------------------------

    async addFiles(noteId: string) {
      let handles: FileSystemFileHandle[]

      try {
        handles = await window.showOpenFilePicker({ multiple: true, startIn: root })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        fail(error, t('filePickerFailed'))
        return
      }

      const paths: string[] = []

      for (const fileHandle of handles) {
        const path = await getRelativePath(root, fileHandle)

        if (path) paths.push(path)
        else toast({ tone: 'error', message: t('fileOutsideProject', { name: fileHandle.name }) })
      }

      actions.linkFiles(noteId, paths)
    },

    linkFiles(noteId: string, paths: string[]) {
      store.update((workspace) => {
        const note = findNote(workspace, noteId)

        if (!note) return workspace

        const filePaths = [...new Set([...note.filePaths, ...paths])]

        return filePaths.length === note.filePaths.length
          ? workspace
          : updateNotes(workspace, [noteId], { filePaths })
      })
    },

    async addImages(noteId: string, files: File[]) {
      const images = files.filter(isImageFile)

      if (images.length === 0) {
        if (files.length > 0) toast({ tone: 'error', message: t('notAnImage') })
        return
      }

      try {
        const paths = await Promise.all(images.map((image) => saveNoteImage(root, noteId, image)))

        store.update((workspace) => {
          const note = findNote(workspace, noteId)

          return note
            ? updateNotes(workspace, [noteId], { images: [...note.images, ...paths] })
            : workspace
        })

        toast({ tone: 'success', message: t('imagesAdded', { count: paths.length }) })
      } catch (error) {
        fail(error, t('imageSaveFailed'))
      }
    },

    /** Pasting a screenshot on the empty board creates a note holding it. */
    async createNoteWithImages(files: File[]) {
      const id = actions.createNote()

      await actions.addImages(id, files)
    },

    async openFile(path: string) {
      try {
        await openProjectFile(root, path)
      } catch (error) {
        fail(
          error,
          error instanceof Error && error.message === 'popup-blocked'
            ? t('popupBlocked')
            : t('fileOpenFailed', { path }),
        )
      }
    },

    copyPath(path: string) {
      void writeClipboardText(path, t('pathCopied'))
    },

    // View ---------------------------------------------------------------------

    /** Centres the view on the selection, or on every note when nothing is selected. */
    center() {
      const notes = ui.selectedNotes.length > 0 ? ui.selectedNotes : current().notes
      const box = boundingRect(notes.map((note) => noteRect(note, sizes)))

      if (box) view.centerOn(box)
    },

    /** Selects one note and brings it to the middle of the screen. */
    showNote(id: string) {
      const note = current().notes.find((item) => item.id === id)

      if (!note) return

      ui.select([id])
      view.centerOn(noteRect(note, sizes))
    },

    resetView() {
      view.reset()
    },

    selectAll() {
      ui.select(current().notes.map((note) => note.id))
    },

    selectStatus(status: NoteStatus) {
      const notes = current().notes.filter((note) => note.status === status)
      const box = boundingRect(notes.map((note) => noteRect(note, sizes)))

      ui.select(notes.map((note) => note.id))
      if (box) view.centerOn(box)
    },

    // Workspace ------------------------------------------------------------------

    updateWorkspace(patch: Partial<Pick<Workspace, 'title' | 'description'>>) {
      store.update((workspace) => ({ ...workspace, ...patch }), { group: 'workspace-info' })
    },

    saveAiContext(text: string) {
      store.update((workspace) => ({ ...workspace, aiContext: text }))
      toast({ tone: 'success', message: t('contextSaved') })
    },

    /** Copies every status look from the Bruto board of another folder. */
    async copyStatusStylesFrom(source: FileSystemDirectoryHandle) {
      const name = source.name

      try {
        if (await source.isSameEntry(root)) {
          toast({ message: t('stylesSourceSelf') })
          return
        }

        if (!(await ensureAccess(source, 'read'))) return

        const disk = await readWorkspaceFile(source, name)

        if (disk.kind !== 'ok') {
          toast({
            tone: 'error',
            message: t(disk.kind === 'missing' ? 'stylesSourceMissing' : 'stylesSourceInvalid', {
              name,
            }),
          })
          return
        }

        const styles = disk.workspace.statusStyles

        if (!styles || Object.keys(styles).length === 0) {
          toast({ message: t('stylesSourceEmpty', { name }) })
          return
        }

        store.update((workspace) => replaceStatusStyles(workspace, styles))
        toast({
          tone: 'success',
          message: t('stylesCopied', { name }),
          action: { label: t('undo'), run: () => store.undo() },
        })
      } catch (error) {
        fail(error, t('stylesCopyFailed'))
      }
    },

    async pickStatusStylesSource() {
      let source: FileSystemDirectoryHandle

      try {
        source = await window.showDirectoryPicker({ id: 'bruto-styles', mode: 'read' })
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          fail(error, t('stylesCopyFailed'))
        }
        return
      }

      await actions.copyStatusStylesFrom(source)
    },

    setStatusStyle(status: NoteStatus, config: StatusStyleConfig | undefined) {
      store.update((workspace) => setStatusStyle(workspace, status, config))
    },

    saveDocumentation(documentation: WorkspaceDocumentation) {
      store.update((workspace) => upsertDocumentation(workspace, documentation))
      ui.setSide(null)
    },

    removeDocumentation(documentation: WorkspaceDocumentation) {
      store.update((workspace) => removeDocumentation(workspace, documentation.id))
      ui.setSide(null)
      toast({
        message: t('documentationRemoved', { name: documentation.name }),
        action: { label: t('undo'), run: () => store.undo() },
      })
    },

    undo: () => store.undo(),
    redo: () => store.redo(),

    async save() {
      await sync.saveNow()
      toast({ message: t('saveStatusSaved') })
    },
  }

  return actions
}

export type WorkspaceActions = ReturnType<typeof createWorkspaceActions>
