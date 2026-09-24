import { useEffect, useRef, useState } from 'react'
import './App.css'
import type {
  AppTheme,
  Connection,
  ContextScope,
  FileTreeNode,
  Language,
  Note,
  NoteStatus,
  SelectedFileInfo,
  StatusStyleConfig,
  Workspace,
  WorkspaceDocumentation,
} from './types'
import { translations } from './i18n/translations'
import type { TranslationKey } from './i18n/translations'
import { buildAiContext, getConnectedNoteIds } from './lib/aiContext'
import { getNoteStyle } from './lib/statusLabels'
import { StatusStylePanel } from './components/StatusStylePanel'
import { saveWorkspace } from './lib/workspaceStorage'
import {
  readDirectoryChildren,
  searchDirectoryRecursively,
  updateDirectoryTreeNode,
  findRelativeFilePath,
  getFileHandleFromPath,
} from './lib/projectFiles'
import { LandingPage } from './components/LandingPage'
import { WorkspaceTopBar } from './components/TopBar'
import { Sidebar } from './components/Sidebar'
import { NoteCard } from './components/NoteCard'
import { ConnectionLayer } from './components/ConnectionLayer'
import { CanvasControls } from './components/CanvasControls'
import { CanvasEmptyState } from './components/CanvasEmptyState'
import { NoteEditor } from './components/NoteEditor'
import { WorkspaceEditor } from './components/WorkspaceEditor'
import { DocumentationEditor } from './components/DocumentationEditor'
import { AiContextPanel } from './components/AiContextPanel'
import { DirectoryPanel } from './components/DirectoryPanel'
import { HelpOverlay } from './components/HelpOverlay'

/** A project stashed in the
 * background after switching
 * away from it. */
interface BackgroundProject {
  directoryHandle: FileSystemDirectoryHandle
  name: string
  workspace: Workspace
  dirty: boolean
}

const CLIPBOARD_STORAGE_KEY = 'bruto-clipboard-note'

function getStoredLanguage(): Language {
  const stored = localStorage.getItem('bruto-language')

  return stored === 'en' ||
    stored === 'ja' ||
    stored === 'ru' ||
    stored === 'zh' ||
    stored === 'ca' ||
    stored === 'fr' ||
    stored === 'de' ||
    stored === 'pt-BR'
    ? stored
    : 'es'
}

function getStoredTheme(): AppTheme {
  const stored = localStorage.getItem('bruto-theme')

  return stored === 'light' ? 'light' : 'dark'
}

function getStoredClipboard(): Note | null {
  try {
    const raw = localStorage.getItem(CLIPBOARD_STORAGE_KEY)

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Note

    if (
      !parsed ||
      typeof parsed.id !== 'string' ||
      typeof parsed.title !== 'string' ||
      !Array.isArray(parsed.filePaths ?? [])
    ) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

interface AppProps {
  language?: Language
  theme?: AppTheme
  onLanguageChange?: (language: Language) => void
  onThemeChange?: (theme: AppTheme) => void
}

function App(
  {
    language: languageProp,
    theme: themeProp,
    onLanguageChange,
    onThemeChange,
  }: AppProps = {} as AppProps,
) {
  // Standalone App owns language
  // and theme internally (with
  // localStorage persistence).
  // The optional props exist so a
  // parent could lift this state,
  // but nothing passes them today.
  const [languageState, setLanguageState] = useState<Language>(languageProp ?? getStoredLanguage)

  const [themeState, setThemeState] = useState<AppTheme>(themeProp ?? getStoredTheme)

  const language = onLanguageChange ? languageProp! : languageState

  const theme = onThemeChange ? themeProp! : themeState

  const canvasRef = useRef<HTMLDivElement | null>(null)

  const setLanguage = onLanguageChange ?? setLanguageState

  const setTheme = onThemeChange ?? setThemeState

  const t = (key: TranslationKey) => translations[language][key] ?? translations.es[key] ?? key

  const [projectName, setProjectName] = useState<string | null>(null)

  const [workspace, setWorkspace] = useState<Workspace | null>(null)

  const latestWorkspaceRef = useRef<Workspace | null>(null)

  const [workspaceDirty, setWorkspaceDirty] = useState(false)

  const autosaveTimerRef = useRef<number | null>(null)

  const historyPastRef = useRef<Workspace[]>([])

  const historyFutureRef = useRef<Workspace[]>([])

  const noteEditorOriginalRef = useRef<Workspace | null>(null)

  const noteEditorHistoryRecordedRef = useRef(false)

  const dragHistorySnapshotRef = useRef<Workspace | null>(null)

  const dragHistoryCommittedRef = useRef(false)

  const [projectDirectory, setProjectDirectory] = useState<FileSystemDirectoryHandle | null>(null)

  const [directoryTree, setDirectoryTree] = useState<FileTreeNode | null>(null)

  const [directorySearchTree, setDirectorySearchTree] = useState<FileTreeNode | null>(null)

  const [directorySearch, setDirectorySearch] = useState('')

  const [directoryPanelOpen, setDirectoryPanelOpen] = useState(false)

  const [directoryLoading, setDirectoryLoading] = useState(false)

  const [directorySearching, setDirectorySearching] = useState(false)

  const [directoryLoadingPath, setDirectoryLoadingPath] = useState<string | null>(null)

  const [expandedDirectories, setExpandedDirectories] = useState<Set<string>>(new Set())

  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)

  const [selectedFileInfo, setSelectedFileInfo] = useState<SelectedFileInfo | null>(null)

  const [directoryRefreshKey, setDirectoryRefreshKey] = useState(0)

  const [loading, setLoading] = useState(false)

  const [creatingNote, setCreatingNote] = useState(false)

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)

  /** Cross-project clipboard:
   * holds the last copied note so
   * Ctrl+V can drop it into any
   * open project's board. It is
   * persisted to localStorage so
   * it survives restarts and page
   * reloads. */
  const [clipboardNote, setClipboardNoteState] = useState<Note | null>(getStoredClipboard)

  /** Id of the note currently
   * playing the "copied" flash
   * animation. */
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null)

  /** Id of the note currently
   * playing the "pasted" pop
   * animation. */
  const [pastedNoteId, setPastedNoteId] = useState<string | null>(null)

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const pastedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setProjectClipboard = (note: Note | null, flashSourceId?: string) => {
    setClipboardNoteState(note)

    try {
      if (note === null) {
        localStorage.removeItem(CLIPBOARD_STORAGE_KEY)
      } else {
        localStorage.setItem(CLIPBOARD_STORAGE_KEY, JSON.stringify(note))
      }
    } catch {
      // Storage full or unavailable:
      // the in-memory clipboard
      // still works for this
      // session.
    }

    if (flashSourceId) {
      setCopiedNoteId(flashSourceId)

      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current)
      }

      copiedTimerRef.current = setTimeout(() => {
        setCopiedNoteId(null)

        copiedTimerRef.current = null
      }, 900)
    }
  }

  const [noteDraft, setNoteDraft] = useState<Note | null>(null)

  /** One-shot flag: the note
   * editor selects the title text
   * on open so a freshly created
   * note can be renamed instantly. */
  const [noteEditorSelectTitle, setNoteEditorSelectTitle] = useState(false)

  const [savingNote, setSavingNote] = useState(false)

  const [addingFiles, setAddingFiles] = useState(false)

  const [openingFilePath, setOpeningFilePath] = useState<string | null>(null)

  const [confirmingDelete, setConfirmingDelete] = useState(false)

  /** Top-bar panel for per-status
   * color/pattern configuration. */
  const [statusStylePanelOpen, setStatusStylePanelOpen] = useState(false)

  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null)

  /** World-space pointer where
   * the active drag started, so
   * every group note moves by the
   * same delta regardless of
   * intermediate renders. */
  const dragStartPointerRef = useRef({
    x: 0,
    y: 0,
  })

  /** Start positions of every note
   * in the dragged group. */
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())

  /** True from the first real move
   * of a note drag until mouse-up:
   * distinguishes a drag from a
   * plain click for the canvas
   * deselect handler. */
  const [hasDraggedNote, setHasDraggedNote] = useState(false)

  /** True once the active drag
   * passes the 4px threshold:
   * below it the gesture is a
   * click, not a drag, so tiny
   * pointer jitter never blocks
   * opening the editor. */
  const dragThresholdPassedRef = useRef(false)

  const [connectingNoteId, setConnectingNoteId] = useState<string | null>(null)

  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)

  const [zoom, setZoom] = useState(1)

  const [pan, setPan] = useState({
    x: 0,
    y: 0,
  })

  const [panning, setPanning] = useState(false)

  const [panStart, setPanStart] = useState({
    x: 0,
    y: 0,
  })

  const [aiContextPanelOpen, setAiContextPanelOpen] = useState(false)

  const [aiContextDraft, setAiContextDraft] = useState('')

  const [savingAiContext, setSavingAiContext] = useState(false)

  const [workspaceEditorOpen, setWorkspaceEditorOpen] = useState(false)

  const [workspaceTitleDraft, setWorkspaceTitleDraft] = useState('')

  const [workspaceDescriptionDraft, setWorkspaceDescriptionDraft] = useState('')

  const [savingWorkspaceInfo, setSavingWorkspaceInfo] = useState(false)

  const [documentationEditorOpen, setDocumentationEditorOpen] = useState(false)

  const [documentationDraft, setDocumentationDraft] = useState<WorkspaceDocumentation | null>(null)

  const [savingDocumentation, setSavingDocumentation] = useState(false)

  const [copiedContext, setCopiedContext] = useState<ContextScope | null>(null)

  const [editorWidth, setEditorWidth] = useState(380)

  const [sidebarVisible, setSidebarVisible] = useState<boolean>(getStoredSidebarVisible)

  const [sidebarWidth, setSidebarWidth] = useState<number>(getStoredSidebarWidth)

  const [resizingSidebar, setResizingSidebar] = useState(false)

  const [sidebarResizeStart, setSidebarResizeStart] = useState({
    x: 0,
    width: 250,
  })

  const [resizingEditor, setResizingEditor] = useState(false)

  const [resizeStart, setResizeStart] = useState({
    x: 0,
    width: 380,
  })

  const [helpOpen, setHelpOpen] = useState(false)

  const [helpSearch, setHelpSearch] = useState('')

  const selectedNote = workspace?.notes.find((note) => note.id === selectedNoteId) ?? null

  /** Ids of every note in the
   * multi-selection (area select
   * or shift+click). */
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([])

  /** All currently selected notes:
   * the multi-selection when set,
   * otherwise the single selected
   * note. */
  const effectiveSelectedNotes = workspace
    ? selectedNoteIds.length > 0
      ? workspace.notes.filter((note) => selectedNoteIds.includes(note.id))
      : selectedNote
        ? [selectedNote]
        : []
    : []

  /** Paint recipes for the AI
   * CONTEXT copy buttons, from the
   * selected note's look (CCuN) and
   * up to five connected notes'
   * looks (CCoN). Each recipe is a
   * list of {color, pattern} strips
   * the panel divides its background
   * into. */
  const aiContextStyles = (() => {
    if (!workspace || !selectedNote) {
      return {
        current: [],
        connected: [],
      }
    }

    const toRecipe = (note: Note) => {
      const style = getNoteStyle(note, workspace)

      return {
        color: style.color,
        pattern: style.pattern,
      }
    }

    const connectedIds = getConnectedNoteIds(workspace, selectedNote.id)

    const connectedNotes = [...connectedIds]
      .filter((id) => id !== selectedNote.id)
      .map((id) => workspace.notes.find((note) => note.id === id))
      .filter((note): note is Note => Boolean(note))
      .slice(0, 5)

    return {
      current: [toRecipe(selectedNote)],
      // No connections means no
      // painted strips: the CCoN
      // button keeps its default look
      // instead of borrowing the
      // current note's colors.
      connected: connectedNotes.length > 0 ? connectedNotes.map(toRecipe) : [],
    }
  })()

  /** Live refs for pan/zoom, so
   * the marquee mouse-up always
   * converts to world coordinates
   * with fresh values. */
  const panRef = useRef(pan)

  const zoomRef = useRef(zoom)

  useEffect(() => {
    panRef.current = pan

    zoomRef.current = zoom
  }, [pan, zoom])

  /** Toggles one note inside the
   * multi-selection (shift+click). */
  const toggleMultiSelectNote = (noteId: string) => {
    setSelectedConnectionId(null)

    // Absorb any stale single
    // selection into the group so
    // the first shift+click starts
    // from the visible selection
    // instead of appearing to be
    // ignored.
    setSelectedNoteIds((current) => {
      const base =
        current.length === 0 && selectedNoteId && selectedNoteId !== noteId
          ? [selectedNoteId]
          : current

      return base.includes(noteId) ? base.filter((id) => id !== noteId) : [...base, noteId]
    })
  }

  /** Live rubber band while area
   * selecting on empty canvas. */
  const [marquee, setMarquee] = useState<{
    x0: number
    y0: number
    x1: number
    y1: number
  } | null>(null)

  const marqueeActiveRef = useRef(false)

  /** When the last real marquee
   * selection ended. The browser
   * fires a `click` on the canvas
   * right after the marquee's
   * mouseup; without this guard
   * that click would instantly
   * clear the fresh selection. */
  const marqueeEndedAtRef = useRef(0)

  const marqueeOriginRef = useRef({
    x: 0,
    y: 0,
  })

  /** Latest marquee rect, read on
   * mouse-up outside React's state
   * batching. */
  const marqueeRef = useRef<{
    x0: number
    y0: number
    x1: number
    y1: number
  } | null>(null)

  useEffect(() => {
    if (!marquee) {
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!marqueeActiveRef.current) {
        return
      }

      const canvas = canvasRef.current

      if (!canvas) {
        return
      }

      const rect = canvas.getBoundingClientRect()

      const next = {
        x0: marqueeOriginRef.current.x,
        y0: marqueeOriginRef.current.y,
        x1: event.clientX - rect.left,
        y1: event.clientY - rect.top,
      }

      marqueeRef.current = next

      setMarquee(next)
    }

    const handleMouseUp = () => {
      marqueeActiveRef.current = false

      const current = marqueeRef.current

      setMarquee(null)

      if (!current) {
        return
      }

      const minX = Math.min(current.x0, current.x1)

      const maxX = Math.max(current.x0, current.x1)

      const minY = Math.min(current.y0, current.y1)

      const maxY = Math.max(current.y0, current.y1)

      if (maxX - minX < 6 && maxY - minY < 6) {
        // A plain click clears the
        // multi-selection.
        setSelectedNoteIds([])

        return
      }

      const panX = panRef.current.x

      const panY = panRef.current.y

      const zoomValue = zoomRef.current

      const worldLeft = (minX - panX) / zoomValue

      const worldTop = (minY - panY) / zoomValue

      const worldRight = (maxX - panX) / zoomValue

      const worldBottom = (maxY - panY) / zoomValue

      // Hit-test against the real rendered
      // cards, not a fixed size: notes grow
      // with their content, so an "280×160"
      // assumption misses every tall note
      // and area-selecting felt broken.
      const selectedIds: string[] = []

      const cards = document.querySelectorAll<HTMLElement>('.note-card[data-note-id]')

      cards.forEach((card) => {
        const noteX = card.offsetLeft

        const noteY = card.offsetTop

        const noteW = card.offsetWidth

        const noteH = card.offsetHeight

        const overlaps =
          noteX + noteW > worldLeft &&
          noteX < worldRight &&
          noteY + noteH > worldTop &&
          noteY < worldBottom

        if (overlaps && card.dataset.noteId) {
          selectedIds.push(card.dataset.noteId)
        }
      })

      // Preserve the workspace order so
      // group z-raising keeps its relative
      // stacking stable across selections.
      const workspaceOrder = workspace
        ? workspace.notes.filter((note) => selectedIds.includes(note.id)).map((note) => note.id)
        : selectedIds

      setSelectedNoteIds(workspaceOrder)

      marqueeEndedAtRef.current = Date.now()
    }

    window.addEventListener('mousemove', handleMouseMove)

    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)

      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [marquee, workspace])

  const startMarquee = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.shiftKey) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()

    marqueeActiveRef.current = true

    marqueeOriginRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }

    marqueeRef.current = {
      x0: marqueeOriginRef.current.x,
      y0: marqueeOriginRef.current.y,
      x1: marqueeOriginRef.current.x,
      y1: marqueeOriginRef.current.y,
    }

    setMarquee({
      x0: marqueeOriginRef.current.x,
      y0: marqueeOriginRef.current.y,
      x1: marqueeOriginRef.current.x,
      y1: marqueeOriginRef.current.y,
    })
  }

  const selectedConnection =
    workspace?.connections.find((connection) => connection.id === selectedConnectionId) ?? null

  useEffect(() => {
    localStorage.setItem('bruto-language', language)
  }, [language])

  useEffect(() => {
    localStorage.setItem('bruto-theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('bruto-sidebar-visible', sidebarVisible ? 'true' : 'false')
  }, [sidebarVisible])

  useEffect(() => {
    localStorage.setItem('bruto-sidebar-width', String(sidebarWidth))
  }, [sidebarWidth])

  useEffect(() => {
    if (!resizingEditor) {
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      const nextWidth = resizeStart.width + (resizeStart.x - event.clientX)

      setEditorWidth(Math.min(760, Math.max(320, nextWidth)))
    }

    const handleMouseUp = () => {
      setResizingEditor(false)
    }

    window.addEventListener('mousemove', handleMouseMove)

    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)

      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingEditor, resizeStart])

  const cloneWorkspace = (data: Workspace): Workspace => structuredClone(data)

  const pushHistorySnapshot = (snapshot: Workspace) => {
    historyPastRef.current = [...historyPastRef.current.slice(-79), cloneWorkspace(snapshot)]

    historyFutureRef.current = []
  }

  const setWorkspaceState = (updatedWorkspace: Workspace, recordHistory = true) => {
    if (recordHistory && workspace) {
      pushHistorySnapshot(workspace)
    }

    setWorkspace(updatedWorkspace)

    latestWorkspaceRef.current = updatedWorkspace

    setWorkspaceDirty(true)
  }

  const replaceWorkspaceState = (updatedWorkspace: Workspace) => {
    setWorkspace(updatedWorkspace)

    latestWorkspaceRef.current = updatedWorkspace

    setWorkspaceDirty(true)
  }

  const saveCurrentWorkspaceNow = async () => {
    if (!projectDirectory) {
      return
    }

    const dataToSave = latestWorkspaceRef.current

    if (!dataToSave) {
      return
    }

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current)

      autosaveTimerRef.current = null
    }

    try {
      await saveWorkspace(projectDirectory, dataToSave)

      if (latestWorkspaceRef.current === dataToSave) {
        setWorkspaceDirty(false)
      }
    } catch (error) {
      console.error('Error guardando workspace:', error)

      window.alert(t('saveFailed'))
    }
  }

  useEffect(() => {
    if (!workspace || !projectDirectory || !workspaceDirty) {
      return
    }

    if (autosaveTimerRef.current !== null) {
      window.clearTimeout(autosaveTimerRef.current)
    }

    autosaveTimerRef.current = window.setTimeout(async () => {
      const dataToSave = latestWorkspaceRef.current

      if (!dataToSave || !projectDirectory) {
        return
      }

      try {
        await saveWorkspace(projectDirectory, dataToSave)

        if (latestWorkspaceRef.current === dataToSave) {
          setWorkspaceDirty(false)
        }
      } catch (error) {
        console.error('Error en autosave:', error)
      } finally {
        autosaveTimerRef.current = null
      }
    }, 450)

    return () => {
      if (autosaveTimerRef.current !== null) {
        window.clearTimeout(autosaveTimerRef.current)

        autosaveTimerRef.current = null
      }
    }
  }, [workspace, projectDirectory, workspaceDirty])

  const closeAllEditors = () => {
    setNoteDraft(null)

    // The note selection survives
    // closing editors: it is what
    // Ctrl+C copies and what the
    // board highlight shows. Click
    // the empty board to deselect.
    setConfirmingDelete(false)

    setWorkspaceEditorOpen(false)

    setDocumentationEditorOpen(false)

    setAiContextPanelOpen(false)
  }

  // Multi-project: one project on
  // screen at a time. The current
  // project is saved and stashed
  // when another one is opened or
  // switched to, so it can be
  // restored instantly from the
  // header switcher without a
  // disk round-trip.
  const [backgroundProjects, setBackgroundProjects] = useState<BackgroundProject[]>([])

  const stashCurrentProject = (): boolean => {
    if (!workspace || !projectDirectory) {
      return false
    }

    const data = latestWorkspaceRef.current ?? workspace

    void saveWorkspace(projectDirectory, data)

    setBackgroundProjects((current) => [
      ...current,
      {
        directoryHandle: projectDirectory,
        name: projectDirectory.name.toUpperCase(),
        workspace: structuredClone(data),
        dirty: false,
      },
    ])

    return true
  }

  const openProject = async () => {
    setLoading(true)

    try {
      const directoryHandle = await window.showDirectoryPicker()

      if (!directoryHandle) {
        return
      }

      // Drop any stale stash of this
      // directory so the same project
      // can never appear twice.
      setBackgroundProjects((current) =>
        current.filter((item) => item.directoryHandle.name !== directoryHandle.name),
      )

      stashCurrentProject()

      await loadProject(directoryHandle)
    } finally {
      setLoading(false)
    }
  }

  const switchToProject = async (project: BackgroundProject) => {
    if (!stashCurrentProject()) {
      return
    }

    setBackgroundProjects((current) => current.filter((item) => item !== project))

    await loadProject(project.directoryHandle, project.workspace)
  }

  const removeBackgroundProject = (project: BackgroundProject) => {
    setBackgroundProjects((current) => current.filter((item) => item !== project))
  }

  /** Ctrl+Tab: cycle to the next
   * open project (Shift goes
   * backwards), stashing the
   * current one like the header
   * switcher does. */
  const cycleProject = (offset: number) => {
    if (!projectDirectory || !workspace) {
      return
    }

    const entries = [
      {
        handle: projectDirectory,
        workspace: latestWorkspaceRef.current ?? workspace,
      },
      ...backgroundProjects.map((project) => ({
        handle: project.directoryHandle,
        workspace: project.workspace,
      })),
    ]

    const currentIndex = entries.findIndex((entry) => entry.handle.name === projectDirectory.name)

    const nextIndex = (currentIndex + offset + entries.length) % entries.length

    if (nextIndex === currentIndex) {
      return
    }

    const next = entries[nextIndex]

    stashCurrentProject()

    setBackgroundProjects((current) =>
      current.filter((item) => item.directoryHandle.name !== next.handle.name),
    )

    void loadProject(next.handle, next.workspace)
  }

  /** Sets or clears the automatic
   * look of one status in the
   * workspace's status style
   * configuration. */
  const configureStatusStyle = (status: NoteStatus, config: StatusStyleConfig | undefined) => {
    if (!workspace) {
      return
    }

    const nextStyles = {
      ...workspace.statusStyles,
    }

    if (!config?.color && !config?.pattern) {
      delete nextStyles[status]
    } else {
      nextStyles[status] = config
    }

    setWorkspaceState({
      ...workspace,
      statusStyles: nextStyles,
    })
  }

  /** Deletes every selected note
   * (bulk Delete, no confirmation,
   * undoable). */
  const deleteSelectedNotes = () => {
    const targets = effectiveSelectedNotes

    if (!workspace || targets.length === 0) {
      return
    }

    const ids = targets.map((note) => note.id)

    const updatedWorkspace: Workspace = {
      ...workspace,
      notes: workspace.notes.filter((note) => !ids.includes(note.id)),
      connections: workspace.connections.filter(
        (connection) => !ids.includes(connection.from) && !ids.includes(connection.to),
      ),
    }

    setWorkspaceState(updatedWorkspace)

    setSelectedNoteId(null)

    setSelectedNoteIds([])

    closeNoteEditor()
  }

  /** Bulk-duplicates every selected
   * note, offset 36px down-right,
   * preserving relative positions. */
  const duplicateSelectedNotes = () => {
    const targets = effectiveSelectedNotes

    if (!workspace || targets.length === 0) {
      return
    }

    const highestZIndex = Math.max(...workspace.notes.map((note) => note.zIndex ?? 0), 0)

    const duplicates: Note[] = targets.map((note) => ({
      ...note,
      id: crypto.randomUUID(),
      title: `${note.title.trim() || t('untitled')} (${t('copySuffix')})`,
      x: note.x + 36,
      y: note.y + 36,
      zIndex: highestZIndex + 1,
    }))

    setWorkspaceState({
      ...workspace,
      notes: [...workspace.notes, ...duplicates],
    })

    setSelectedNoteIds(duplicates.map((note) => note.id))
  }

  /** Copies every selected note
   * onto the clipboard so Ctrl+V
   * re-creates the whole group
   * (with their relationships)
   * in any project. */
  const copySelectedNotesToClipboard = () => {
    const targets = effectiveSelectedNotes

    if (!workspace || targets.length === 0) {
      return
    }

    const ids = targets.map((note) => note.id)

    const relatedConnections = workspace.connections.filter(
      (connection) => ids.includes(connection.from) && ids.includes(connection.to),
    )

    setProjectClipboard(
      {
        ...targets[0],
        title: `${targets[0].title.trim() || t('untitled')} (${t('copySuffix')})`,
        filePaths: [...(targets[0].filePaths ?? [])],
        images: [...(targets[0].images ?? [])],
        notes: structuredClone(targets),
        connections: structuredClone(relatedConnections),
      } as Note,
      targets[0].id,
    )
  }

  const closeProject = async () => {
    if (workspace && projectDirectory) {
      await saveWorkspace(projectDirectory, latestWorkspaceRef.current ?? workspace)
    }

    if (backgroundProjects.length > 0) {
      // Close the current project
      // and show the first stashed
      // one — without re-stashing
      // the project being closed.
      const next = backgroundProjects[0]

      setBackgroundProjects((current) => current.filter((item) => item !== next))

      await loadProject(next.directoryHandle, next.workspace)

      return
    }

    setBackgroundProjects([])

    setWorkspace(null)

    latestWorkspaceRef.current = null

    setProjectDirectory(null)

    setProjectName(null)

    setSelectedNoteId(null)

    setSelectedConnectionId(null)

    setConnectingNoteId(null)

    setNoteDraft(null)

    historyPastRef.current = []

    historyFutureRef.current = []

    noteEditorOriginalRef.current = null

    noteEditorHistoryRecordedRef.current = false
  }

  const loadProject = async (
    handleOverride?: FileSystemDirectoryHandle,
    stashOverride?: Workspace,
  ) => {
    try {
      setLoading(true)

      const directoryHandle = handleOverride

      if (!directoryHandle) {
        return
      }

      setProjectDirectory(directoryHandle)

      setDirectoryTree(null)

      setDirectorySearchTree(null)

      setDirectorySearch('')

      setSelectedFilePath(null)

      setSelectedFileInfo(null)

      setExpandedDirectories(new Set())

      const brutoDirectory = await directoryHandle.getDirectoryHandle('.bruto', {
        create: true,
      })

      let workspaceData: Workspace

      if (stashOverride) {
        workspaceData = structuredClone(stashOverride)
      } else {
        try {
          const workspaceFile = await brutoDirectory.getFileHandle('workspace.json')

          const file = await workspaceFile.getFile()

          const text = await file.text()

          const parsedWorkspace: Workspace = JSON.parse(text)

          const notesWithDefaults = parsedWorkspace.notes.map((note, index) => ({
            ...note,
            zIndex: note.zIndex ?? index + 1,
            filePaths: note.filePaths ?? [],
            images: note.images ?? [],
            aiResponse: note.aiResponse ?? undefined,
            colorTheme: note.colorTheme ?? 'concrete',
            pattern: note.pattern ?? 'raw',
            status: note.status ?? undefined,
          }))

          workspaceData = {
            ...parsedWorkspace,
            version: parsedWorkspace.version ?? 2,
            aiContext: parsedWorkspace.aiContext ?? '',
            documentation: parsedWorkspace.documentation ?? [],
            connections: parsedWorkspace.connections ?? [],
            notes: notesWithDefaults,
          }
        } catch {
          workspaceData = {
            version: 2,
            title: directoryHandle.name.toUpperCase(),
            description: '',
            aiContext: '',
            documentation: [],
            notes: [],
            connections: [],
          }

          await saveWorkspace(directoryHandle, workspaceData)
        }
      }

      setProjectName(directoryHandle.name.toUpperCase())

      setWorkspace(workspaceData)

      latestWorkspaceRef.current = workspaceData

      setWorkspaceDirty(false)

      historyPastRef.current = []
      historyFutureRef.current = []
      noteEditorOriginalRef.current = null
      noteEditorHistoryRecordedRef.current = false

      setSelectedNoteId(null)

      setSelectedConnectionId(null)

      setConnectingNoteId(null)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const createNote = async () => {
    if (!workspace || !projectDirectory) {
      return
    }

    try {
      setCreatingNote(true)

      const highestZIndex = Math.max(...workspace.notes.map((note) => note.zIndex ?? 0), 0)

      const note: Note = {
        id: crypto.randomUUID(),
        title: t('newNoteTitle'),
        description: '',
        filePaths: [],
        webUrl: '',
        images: [],
        x: 200 + workspace.notes.length * 25,
        y: 150 + workspace.notes.length * 25,
        zIndex: highestZIndex + 1,
        colorTheme: 'concrete',
        pattern: 'raw',
        status: 'idea',
      }

      const updatedWorkspace: Workspace = {
        ...workspace,
        notes: [...workspace.notes, note],
      }

      setWorkspaceState(updatedWorkspace)

      openNote(note, true)
    } catch (error) {
      console.error('Error creando nota:', error)
    } finally {
      setCreatingNote(false)
    }
  }

  const handleNoteMiddleClick = (event: React.MouseEvent<HTMLElement>, note: Note) => {
    event.preventDefault()
    event.stopPropagation()

    setSelectedConnectionId(null)

    if (!connectingNoteId) {
      setConnectingNoteId(note.id)

      return
    }

    if (connectingNoteId === note.id) {
      setConnectingNoteId(null)

      return
    }

    if (!workspace) {
      return
    }

    const existingConnection = workspace.connections.find(
      (connection) => connection.from === connectingNoteId && connection.to === note.id,
    )

    if (existingConnection) {
      setConnectingNoteId(null)

      return
    }

    const newConnection: Connection = {
      id: crypto.randomUUID(),
      from: connectingNoteId,
      to: note.id,
    }

    const updatedWorkspace: Workspace = {
      ...workspace,
      connections: [...workspace.connections, newConnection],
    }

    setWorkspaceState(updatedWorkspace)

    setConnectingNoteId(null)
  }

  const createDirectoryRootNode = (
    directoryHandle: FileSystemDirectoryHandle,
    children: FileTreeNode[],
  ): FileTreeNode => ({
    name: projectName?.toUpperCase() || directoryHandle.name.toUpperCase() || t('directoryRoot'),
    path: '',
    kind: 'directory',
    handle: directoryHandle,
    children,
    loaded: true,
  })

  const loadRootDirectory = async (directoryHandle: FileSystemDirectoryHandle) => {
    try {
      setDirectoryLoading(true)

      const children = await readDirectoryChildren(directoryHandle)

      const root = createDirectoryRootNode(directoryHandle, children)

      setDirectoryTree(root)

      setExpandedDirectories(new Set(['']))
    } catch (error) {
      console.error('Error leyendo el directorio:', error)
    } finally {
      setDirectoryLoading(false)
    }
  }

  const loadDirectoryNode = async (node: FileTreeNode) => {
    if (node.kind !== 'directory' || !node.handle) {
      return
    }

    if (node.loaded) {
      setExpandedDirectories((previous) => {
        const next = new Set(previous)

        if (next.has(node.path)) {
          next.delete(node.path)
        } else {
          next.add(node.path)
        }

        return next
      })

      return
    }

    try {
      setDirectoryLoadingPath(node.path)

      const children = await readDirectoryChildren(
        node.handle as FileSystemDirectoryHandle,
        node.path,
      )

      setDirectoryTree((previous) =>
        previous ? updateDirectoryTreeNode(previous, node.path, children) : previous,
      )

      setExpandedDirectories((previous) => {
        const next = new Set(previous)

        next.add(node.path)

        return next
      })
    } catch (error) {
      console.error('Error leyendo directorio:', error)
    } finally {
      setDirectoryLoadingPath(null)
    }
  }

  useEffect(() => {
    if (!directoryPanelOpen || !projectDirectory || !directorySearch.trim()) {
      setDirectorySearchTree(null)

      setDirectorySearching(false)

      return
    }

    let cancelled = false

    const timeout = window.setTimeout(async () => {
      try {
        setDirectorySearching(true)

        const query = directorySearch.trim().toLowerCase()

        const children = await searchDirectoryRecursively(projectDirectory, '', query)

        if (cancelled) {
          return
        }

        setDirectorySearchTree(createDirectoryRootNode(projectDirectory, children))
      } catch (error) {
        console.error('Error buscando archivos:', error)

        if (!cancelled) {
          setDirectorySearchTree(createDirectoryRootNode(projectDirectory, []))
        }
      } finally {
        if (!cancelled) {
          setDirectorySearching(false)
        }
      }
    }, 180)

    return () => {
      cancelled = true

      window.clearTimeout(timeout)
    }
  }, [directoryPanelOpen, projectDirectory, directorySearch, directoryRefreshKey])

  const refreshDirectory = async () => {
    if (!projectDirectory) {
      return
    }

    setSelectedFilePath(null)

    setSelectedFileInfo(null)

    setDirectorySearchTree(null)

    setDirectoryRefreshKey((value) => value + 1)

    await loadRootDirectory(projectDirectory)
  }

  const openStatusStylePanel = () => {
    setHelpOpen(false)

    closeNoteEditor()

    setWorkspaceEditorOpen(false)

    setDocumentationEditorOpen(false)

    setAiContextPanelOpen(false)

    setDirectoryPanelOpen(false)

    setStatusStylePanelOpen(true)
  }

  const openDirectoryPanel = async () => {
    if (!projectDirectory) {
      return
    }

    setHelpOpen(false)

    closeNoteEditor()

    setWorkspaceEditorOpen(false)

    setDocumentationEditorOpen(false)

    setAiContextPanelOpen(false)

    setSelectedConnectionId(null)

    setConnectingNoteId(null)

    setDirectoryPanelOpen(true)

    if (!directoryTree) {
      await loadRootDirectory(projectDirectory)
    }
  }

  const closeDirectoryPanel = () => {
    setDirectoryPanelOpen(false)

    setDirectorySearch('')

    setDirectorySearchTree(null)
  }

  const selectFileFromTree = async (node: FileTreeNode) => {
    if (node.kind !== 'file') {
      return
    }

    setSelectedFilePath(node.path)

    setSelectedFileInfo(null)

    try {
      const file = await (node.handle as FileSystemFileHandle).getFile()

      setSelectedFileInfo({
        name: file.name,
        path: node.path,
        size: file.size,
        lastModified: file.lastModified,
        type: file.type || 'application/octet-stream',
      })
    } catch (error) {
      console.error('Error leyendo información del archivo:', error)
    }
  }

  const startDraggingNote = (event: React.MouseEvent<HTMLElement>, note: Note) => {
    event.stopPropagation()

    if (event.button === 1) {
      event.preventDefault()

      handleNoteMiddleClick(event, note)

      return
    }

    if (event.button !== 0) {
      return
    }

    setSelectedConnectionId(null)

    const canvas = canvasRef.current

    if (!canvas || !workspace) {
      return
    }

    const canvasRect = canvas.getBoundingClientRect()

    const pointerX = (event.clientX - canvasRect.left - pan.x) / zoom

    const pointerY = (event.clientY - canvasRect.top - pan.y) / zoom

    const highestZIndex = Math.max(...workspace.notes.map((item) => item.zIndex ?? 0), 0)

    dragHistorySnapshotRef.current = cloneWorkspace(workspace)

    dragHistoryCommittedRef.current = false

    // A group drag: when the grabbed
    // note belongs to the active
    // multi-selection, every selected
    // note moves together; otherwise
    // only the grabbed note moves.
    const draggingIds = selectedNoteIds.includes(note.id) ? selectedNoteIds : [note.id]

    dragStartPointerRef.current = {
      x: pointerX,
      y: pointerY,
    }

    dragStartPositionsRef.current = new Map(
      workspace.notes
        .filter((item) => draggingIds.includes(item.id))
        .map((item) => [
          item.id,
          {
            x: item.x,
            y: item.y,
          },
        ]),
    )

    // Raise the whole group above
    // everything else, keeping their
    // relative stacking order.
    const updatedWorkspace: Workspace = {
      ...workspace,
      notes: workspace.notes.map((item) => {
        const groupIndex = draggingIds.indexOf(item.id)

        if (groupIndex === -1) {
          return item
        }

        return {
          ...item,
          zIndex: highestZIndex + 1 + groupIndex,
        }
      }),
    }

    replaceWorkspaceState(updatedWorkspace)

    setDraggingNoteId(note.id)

    setHasDraggedNote(false)

    dragThresholdPassedRef.current = false
  }

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (panning) {
      setPan({
        x: event.clientX - panStart.x,
        y: event.clientY - panStart.y,
      })

      return
    }

    if (!draggingNoteId || !workspace) {
      return
    }

    const canvasRect = event.currentTarget.getBoundingClientRect()

    const pointerX = (event.clientX - canvasRect.left - pan.x) / zoom

    const pointerY = (event.clientY - canvasRect.top - pan.y) / zoom

    const deltaX = pointerX - dragStartPointerRef.current.x

    const deltaY = pointerY - dragStartPointerRef.current.y

    // Below the threshold this is
    // still the click part of the
    // gesture: nothing moves and
    // the following click opens
    // the editor as expected.
    if (!dragThresholdPassedRef.current) {
      if (Math.hypot(deltaX, deltaY) < 4) {
        return
      }

      dragThresholdPassedRef.current = true
    }

    if (!dragHistoryCommittedRef.current && dragHistorySnapshotRef.current) {
      pushHistorySnapshot(dragHistorySnapshotRef.current)

      dragHistoryCommittedRef.current = true
    }

    setHasDraggedNote(true)

    const updatedWorkspace: Workspace = {
      ...workspace,
      notes: workspace.notes.map((note) => {
        const start = dragStartPositionsRef.current.get(note.id)

        if (!start) {
          return note
        }

        return {
          ...note,
          x: start.x + deltaX,
          y: start.y + deltaY,
        }
      }),
    }

    replaceWorkspaceState(updatedWorkspace)
  }

  const stopDraggingNote = async () => {
    if (panning) {
      setPanning(false)

      return
    }

    if (!draggingNoteId) {
      return
    }

    setDraggingNoteId(null)

    dragHistorySnapshotRef.current = null

    dragHistoryCommittedRef.current = false
  }

  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 1) {
      return
    }

    event.preventDefault()

    setPanning(true)

    setPanStart({
      x: event.clientX - pan.x,
      y: event.clientY - pan.y,
    })
  }

  const handleCanvasWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()

    const canvasRect = event.currentTarget.getBoundingClientRect()

    const mouseX = event.clientX - canvasRect.left

    const mouseY = event.clientY - canvasRect.top

    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9

    const newZoom = Math.min(2, Math.max(0.25, zoom * zoomFactor))

    if (newZoom === zoom) {
      return
    }

    const worldX = (mouseX - pan.x) / zoom

    const worldY = (mouseY - pan.y) / zoom

    setPan({
      x: mouseX - worldX * newZoom,
      y: mouseY - worldY * newZoom,
    })

    setZoom(newZoom)
  }

  const zoomIn = () => {
    setZoom(Math.min(2, zoom * 1.15))
  }

  const zoomOut = () => {
    setZoom(Math.max(0.25, zoom / 1.15))
  }

  const resetCanvasView = () => {
    setZoom(1)

    setPan({
      x: 0,
      y: 0,
    })
  }

  const centerOnNote = (note: Note) => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const rect = canvas.getBoundingClientRect()

    const noteCenterX = note.x + 140

    const noteCenterY = note.y + 80

    setPan({
      x: rect.width / 2 - noteCenterX * zoom,
      y: rect.height / 2 - noteCenterY * zoom,
    })
  }

  /** F on a multi-selection:
   * centers the view on the middle
   * of the group's bounding box. */
  const centerOnNotes = (notes: Note[]) => {
    if (notes.length === 0) {
      return
    }

    if (notes.length === 1) {
      centerOnNote(notes[0])

      return
    }

    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const rect = canvas.getBoundingClientRect()

    const minX = Math.min(...notes.map((note) => note.x))

    const maxX = Math.max(...notes.map((note) => note.x)) + 280

    const minY = Math.min(...notes.map((note) => note.y))

    const maxY = Math.max(...notes.map((note) => note.y)) + 160

    setPan({
      x: rect.width / 2 - ((minX + maxX) / 2) * zoom,
      y: rect.height / 2 - ((minY + maxY) / 2) * zoom,
    })
  }

  const openNote = (note: Note, selectTitle = false) => {
    setHelpOpen(false)

    closeDirectoryPanel()

    setAiContextPanelOpen(false)

    setWorkspaceEditorOpen(false)

    setDocumentationEditorOpen(false)

    setSelectedNoteId(note.id)

    setNoteEditorSelectTitle(selectTitle)

    setNoteDraft({
      ...note,
      filePaths: [...(note.filePaths ?? [])],
      images: [...(note.images ?? [])],
      colorTheme: note.colorTheme ?? 'concrete',
      pattern: note.pattern ?? 'raw',
    })

    noteEditorOriginalRef.current = cloneWorkspace(latestWorkspaceRef.current ?? workspace!)

    noteEditorHistoryRecordedRef.current = false

    setConfirmingDelete(false)

    setSelectedConnectionId(null)
  }

  const closeNoteEditor = () => {
    setNoteDraft(null)

    setConfirmingDelete(false)

    noteEditorOriginalRef.current = null

    noteEditorHistoryRecordedRef.current = false
  }

  const applyNoteDraftChange = (nextDraft: Note) => {
    setNoteDraft(nextDraft)

    if (!workspace) {
      return
    }

    if (!noteEditorHistoryRecordedRef.current && noteEditorOriginalRef.current) {
      pushHistorySnapshot(noteEditorOriginalRef.current)

      noteEditorHistoryRecordedRef.current = true
    }

    const updatedWorkspace: Workspace = {
      ...workspace,
      notes: workspace.notes.map((note) =>
        note.id === nextDraft.id
          ? {
              // Position and z-order
              // always come from the
              // live workspace: the
              // draft is a snapshot
              // from when the editor
              // opened, and the note
              // may have been dragged
              // since (dragging does
              // not touch the draft),
              // so trusting the draft
              // here would teleport
              // the note back.
              ...nextDraft,
              x: note.x,
              y: note.y,
              zIndex: note.zIndex ?? nextDraft.zIndex,
            }
          : note,
      ),
    }

    replaceWorkspaceState(updatedWorkspace)
  }

  const updateNoteDraft = (
    field: 'title' | 'description' | 'webUrl' | 'status' | 'aiResponse',
    value: string,
  ) => {
    if (!noteDraft) {
      return
    }

    if (field === 'status') {
      // Notes on the "auto" color
      // re-tint live because the
      // card derives its color from
      // the current status.
      applyNoteDraftChange({
        ...noteDraft,
        status: value === '' ? undefined : (value as NoteStatus),
      })

      return
    }

    if (field === 'aiResponse') {
      // Clearing it removes the
      // field entirely so the card
      // section hides again.
      applyNoteDraftChange({
        ...noteDraft,
        aiResponse: value.trim() ? value : undefined,
      })

      return
    }

    applyNoteDraftChange({
      ...noteDraft,
      [field]: value,
    })
  }

  useEffect(() => {
    if (!resizingSidebar) {
      return
    }

    const handleMouseMove = (event: MouseEvent) => {
      const nextWidth = sidebarResizeStart.width + (event.clientX - sidebarResizeStart.x)

      setSidebarWidth(Math.min(560, Math.max(190, nextWidth)))
    }

    const handleMouseUp = () => {
      setResizingSidebar(false)
    }

    window.addEventListener('mousemove', handleMouseMove)

    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)

      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [resizingSidebar, sidebarResizeStart])

  const startSidebarResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    setResizingSidebar(true)

    setSidebarResizeStart({
      x: event.clientX,
      width: sidebarWidth,
    })
  }

  const toggleSidebar = () => {
    setSidebarVisible((previous) => !previous)
  }

  const startEditorResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    setResizingEditor(true)

    setResizeStart({
      x: event.clientX,
      width: editorWidth,
    })
  }

  const openWorkspaceEditor = () => {
    if (!workspace) {
      return
    }

    closeNoteEditor()
    closeDirectoryPanel()

    setAiContextPanelOpen(false)

    setDocumentationEditorOpen(false)

    setSelectedConnectionId(null)

    setConnectingNoteId(null)

    setWorkspaceTitleDraft(workspace.title)

    setWorkspaceDescriptionDraft(workspace.description)

    setWorkspaceEditorOpen(true)
  }

  const closeWorkspaceEditor = () => {
    setWorkspaceEditorOpen(false)
  }

  const saveWorkspaceInfo = async () => {
    if (!workspace) {
      return
    }

    try {
      setSavingWorkspaceInfo(true)

      const title =
        workspaceTitleDraft.trim() || workspace.title || projectName?.toUpperCase() || 'Workspace'

      const updatedWorkspace: Workspace = {
        ...workspace,
        title,
        description: workspaceDescriptionDraft,
      }

      setWorkspaceState(updatedWorkspace)

      setWorkspaceEditorOpen(false)
    } catch (error) {
      console.error('Error guardando workspace:', error)
    } finally {
      setSavingWorkspaceInfo(false)
    }
  }

  const openAiContextPanel = () => {
    if (!workspace) {
      return
    }

    closeNoteEditor()
    closeDirectoryPanel()

    setWorkspaceEditorOpen(false)

    setDocumentationEditorOpen(false)

    setSelectedConnectionId(null)

    setConnectingNoteId(null)

    setAiContextDraft(workspace.aiContext ?? '')

    setAiContextPanelOpen(true)
  }

  const closeAiContextPanel = () => {
    setAiContextPanelOpen(false)
  }

  const saveAiContext = async () => {
    if (!workspace) {
      return
    }

    try {
      setSavingAiContext(true)

      const updatedWorkspace: Workspace = {
        ...workspace,
        aiContext: aiContextDraft,
      }

      setWorkspaceState(updatedWorkspace)

      setAiContextPanelOpen(false)
    } catch (error) {
      console.error('Error guardando contexto:', error)
    } finally {
      setSavingAiContext(false)
    }
  }

  const openDocumentationEditor = (documentation?: WorkspaceDocumentation) => {
    closeNoteEditor()
    closeDirectoryPanel()

    setWorkspaceEditorOpen(false)

    setAiContextPanelOpen(false)

    setSelectedConnectionId(null)

    setConnectingNoteId(null)

    if (documentation) {
      setDocumentationDraft({
        ...documentation,
      })
    } else {
      setDocumentationDraft({
        id: crypto.randomUUID(),
        name: '',
        url: '',
        type: 'web',
      })
    }

    setDocumentationEditorOpen(true)
  }

  const closeDocumentationEditor = () => {
    setDocumentationEditorOpen(false)

    setDocumentationDraft(null)
  }

  const saveDocumentation = async () => {
    if (!workspace || !documentationDraft) {
      return
    }

    const name = documentationDraft.name.trim()

    const url = documentationDraft.url.trim()

    if (!name) {
      window.alert(t('documentationNeedsName'))

      return
    }

    if (!url) {
      window.alert(t('documentationNeedsLink'))

      return
    }

    try {
      setSavingDocumentation(true)

      const exists = workspace.documentation.some((item) => item.id === documentationDraft.id)

      const documentation = exists
        ? workspace.documentation.map((item) =>
            item.id === documentationDraft.id
              ? {
                  ...documentationDraft,
                  name,
                  url,
                }
              : item,
          )
        : [
            ...workspace.documentation,
            {
              ...documentationDraft,
              name,
              url,
            },
          ]

      const updatedWorkspace: Workspace = {
        ...workspace,
        documentation,
      }

      setWorkspaceState(updatedWorkspace)

      closeDocumentationEditor()
    } catch (error) {
      console.error('Error guardando documentación:', error)
    } finally {
      setSavingDocumentation(false)
    }
  }

  const deleteDocumentation = async (documentationId: string) => {
    if (!workspace) {
      return
    }

    const documentation = workspace.documentation.find((item) => item.id === documentationId)

    if (!documentation) {
      return
    }

    if (!window.confirm(t('removeDocumentation'))) {
      return
    }

    const updatedWorkspace: Workspace = {
      ...workspace,
      documentation: workspace.documentation.filter((item) => item.id !== documentationId),
    }

    setWorkspaceState(updatedWorkspace)

    closeDocumentationEditor()
  }

  const openDocumentation = (documentation: WorkspaceDocumentation) => {
    const newWindow = window.open(documentation.url, '_blank', 'noopener,noreferrer')

    if (!newWindow) {
      window.alert(t('documentationOpenBlocked'))
    }
  }

  const copyContext = async (scope: ContextScope) => {
    if (!workspace) {
      return
    }

    // A multi-selection copies
    // every selected note; a plain
    // selection copies the single
    // selected note.
    const contextNoteIds =
      selectedNoteIds.length > 0 ? selectedNoteIds : selectedNoteId ? [selectedNoteId] : []

    if (scope !== 'entire' && contextNoteIds.length === 0) {
      return
    }

    try {
      const context = buildAiContext(workspace, scope, contextNoteIds)

      await navigator.clipboard.writeText(context)

      setCopiedContext(scope)

      window.setTimeout(() => {
        setCopiedContext(null)
      }, 1800)
    } catch (error) {
      console.error('Error copiando contexto:', error)

      window.alert(t('contextCopyFailed'))
    }
  }

  const addFilesToNote = async () => {
    if (!projectDirectory || !noteDraft) {
      return
    }

    try {
      setAddingFiles(true)

      const fileHandles = await window.showOpenFilePicker({
        multiple: true,
        startIn: projectDirectory,
      })

      const newPaths: string[] = []

      for (const fileHandle of fileHandles) {
        const relativePath = await findRelativeFilePath(projectDirectory, fileHandle)

        if (relativePath && !noteDraft.filePaths.includes(relativePath)) {
          newPaths.push(relativePath)
        }
      }

      if (newPaths.length > 0) {
        applyNoteDraftChange({
          ...noteDraft,
          filePaths: [...noteDraft.filePaths, ...newPaths],
        })
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      console.error('Error añadiendo archivos:', error)
    } finally {
      setAddingFiles(false)
    }
  }

  const removeFileFromNote = (filePath: string) => {
    if (!noteDraft) {
      return
    }

    applyNoteDraftChange({
      ...noteDraft,
      filePaths: noteDraft.filePaths.filter((path) => path !== filePath),
    })
  }

  const openProjectFile = async (filePath: string) => {
    if (!projectDirectory) {
      return
    }

    try {
      setOpeningFilePath(filePath)

      const fileHandle = await getFileHandleFromPath(projectDirectory, filePath, t('emptyFilePath'))

      const file = await fileHandle.getFile()

      const url = URL.createObjectURL(file)

      const newWindow = window.open(url, '_blank')

      if (!newWindow) {
        URL.revokeObjectURL(url)

        throw new Error(t('fileOpenBlocked'))
      }

      setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 60000)
    } catch (error) {
      console.error('Error abriendo archivo:', error)

      window.alert(`${t('fileOpenFailed')}\n\n${filePath}`)
    } finally {
      setOpeningFilePath(null)
    }
  }

  const saveNote = async () => {
    if (!noteDraft) {
      return
    }

    setSavingNote(true)

    await saveCurrentWorkspaceNow()

    setSavingNote(false)

    closeNoteEditor()
  }

  const deleteNote = async () => {
    if (!workspace || !selectedNoteId) {
      return
    }

    const updatedWorkspace: Workspace = {
      ...workspace,
      notes: workspace.notes.filter((note) => note.id !== selectedNoteId),
      connections: workspace.connections.filter(
        (connection) => connection.from !== selectedNoteId && connection.to !== selectedNoteId,
      ),
    }

    setWorkspaceState(updatedWorkspace)

    setSelectedNoteId(null)

    closeNoteEditor()
  }

  const deleteConnection = async (connectionId: string) => {
    if (!workspace) {
      return
    }

    const updatedWorkspace: Workspace = {
      ...workspace,
      connections: workspace.connections.filter((item) => item.id !== connectionId),
    }

    setWorkspaceState(updatedWorkspace)

    if (selectedConnectionId === connectionId) {
      setSelectedConnectionId(null)
    }
  }

  const deleteSelectedConnection = async () => {
    if (!selectedConnectionId) {
      return
    }

    await deleteConnection(selectedConnectionId)
  }

  const duplicateSelectedNote = () => {
    if (!workspace || !selectedNote) {
      return
    }

    const highestZIndex = Math.max(...workspace.notes.map((note) => note.zIndex ?? 0), 0)

    const sourceTitle = selectedNote.title.trim() || t('untitled')

    const duplicate: Note = {
      ...selectedNote,
      id: crypto.randomUUID(),
      title: `${sourceTitle} (${t('copySuffix')})`,
      x: selectedNote.x + 36,
      y: selectedNote.y + 36,
      zIndex: highestZIndex + 1,
    }

    const updatedWorkspace: Workspace = {
      ...workspace,
      notes: [...workspace.notes, duplicate],
    }

    setWorkspaceState(updatedWorkspace)

    openNote(duplicate)
  }

  const undoWorkspace = () => {
    if (!workspace || historyPastRef.current.length === 0) {
      return
    }

    const previous = historyPastRef.current.pop()

    if (!previous) {
      return
    }

    historyFutureRef.current.push(cloneWorkspace(workspace))

    setWorkspace(previous)

    latestWorkspaceRef.current = previous

    setWorkspaceDirty(true)

    closeAllEditors()

    setDirectoryPanelOpen(false)

    setConnectingNoteId(null)

    setSelectedConnectionId(null)
  }

  const redoWorkspace = () => {
    if (!workspace || historyFutureRef.current.length === 0) {
      return
    }

    const next = historyFutureRef.current.pop()

    if (!next) {
      return
    }

    historyPastRef.current.push(cloneWorkspace(workspace))

    setWorkspace(next)

    latestWorkspaceRef.current = next

    setWorkspaceDirty(true)

    closeAllEditors()

    setDirectoryPanelOpen(false)

    setConnectingNoteId(null)

    setSelectedConnectionId(null)
  }

  const openHelp = () => {
    setHelpSearch('')

    setHelpOpen(true)

    closeDirectoryPanel()

    setAiContextPanelOpen(false)

    setWorkspaceEditorOpen(false)

    setDocumentationEditorOpen(false)
  }

  const isEditableElement = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
      return false
    }

    const tagName = target.tagName

    return (
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      tagName === 'SELECT' ||
      target.isContentEditable
    )
  }

  /** Shared by Ctrl+C and the
   * COPIAR button: stores the
   * selected note in the
   * persistent clipboard and
   * flashes the copy animation. */
  const copySelectedNoteToClipboard = () => {
    if (!selectedNote || !workspace) {
      return
    }

    const sourceTitle = selectedNote.title.trim() || t('untitled')

    setProjectClipboard(
      {
        ...selectedNote,
        title: `${sourceTitle} (${t('copySuffix')})`,
      },
      selectedNote.id,
    )
  }

  /** Shared by Ctrl+V and the
   * PEGAR button: drops the
   * clipboard note onto the board
   * at the center of the current
   * view. Works while the note
   * editor is open too, so it can
   * never fail silently. */
  const pasteClipboardNote = () => {
    if (!clipboardNote || !workspace || !projectDirectory) {
      return
    }

    const highestZIndex = Math.max(...workspace.notes.map((note) => note.zIndex ?? 0), 0)

    // Drop the copy in the middle
    // of what the user is looking
    // at, so it always lands in
    // view. With an empty board,
    // fall back to a spot near
    // the origin.
    const canvasRect = canvasRef.current?.getBoundingClientRect()

    const viewportWidth = canvasRect?.width ?? window.innerWidth

    const viewportHeight = canvasRect?.height ?? window.innerHeight

    const worldX = (viewportWidth / 2 - pan.x) / zoom

    const worldY = (viewportHeight / 2 - pan.y) / zoom

    const baseX = workspace.notes.length > 0 ? worldX : 200

    const baseY = workspace.notes.length > 0 ? worldY : 150

    // A group clipboard carries the
    // whole selection inside it.
    const groupNotes = (
      clipboardNote as Note & {
        notes?: Note[]
        connections?: Workspace['connections']
      }
    ).notes

    const pastedNotes: Note[] = groupNotes
      ? groupNotes.map((note, index) => ({
          ...note,
          id: crypto.randomUUID(),
          x: Math.round(baseX - 140) + (note.x - groupNotes[0].x),
          y: Math.round(baseY - 80) + (note.y - groupNotes[0].y),
          zIndex: highestZIndex + 1 + index,
        }))
      : [
          {
            ...clipboardNote,
            id: crypto.randomUUID(),
            x: Math.round(baseX - 140),
            y: Math.round(baseY - 80),
            zIndex: highestZIndex + 1,
          },
        ]

    // Remap group connections onto
    // the fresh ids.
    const idRemap = new Map<string, string>()

    if (groupNotes) {
      groupNotes.forEach((note, index) => {
        idRemap.set(note.id, pastedNotes[index].id)
      })
    }

    const groupConnections =
      (
        clipboardNote as Note & {
          connections?: Workspace['connections']
        }
      ).connections?.map((connection) => ({
        ...connection,
        id: crypto.randomUUID(),
        from: idRemap.get(connection.from) ?? connection.from,
        to: idRemap.get(connection.to) ?? connection.to,
      })) ?? []

    const updatedWorkspace: Workspace = {
      ...workspace,
      notes: [...workspace.notes, ...pastedNotes],
      connections: [...workspace.connections, ...groupConnections],
    }

    setWorkspaceState(updatedWorkspace)

    setSelectedNoteId(pastedNotes[0].id)

    setSelectedNoteIds(pastedNotes.map((note) => note.id))

    // Pop animation on the fresh
    // cards so the paste is clearly
    // visible.
    setPastedNoteId(pastedNotes[0].id)

    if (pastedTimerRef.current) {
      clearTimeout(pastedTimerRef.current)
    }

    pastedTimerRef.current = setTimeout(() => {
      setPastedNoteId(null)

      pastedTimerRef.current = null
    }, 500)
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()

      const isMeta = event.ctrlKey || event.metaKey

      if (event.key === 'Escape') {
        if (helpOpen) {
          setHelpOpen(false)

          return
        }

        if (directoryPanelOpen) {
          closeDirectoryPanel()

          return
        }

        if (aiContextPanelOpen) {
          closeAiContextPanel()

          return
        }

        if (noteDraft || workspaceEditorOpen || documentationEditorOpen || statusStylePanelOpen) {
          if (statusStylePanelOpen) {
            setStatusStylePanelOpen(false)
          }

          closeAllEditors()

          return
        }

        setConnectingNoteId(null)

        setSelectedConnectionId(null)

        setSelectedNoteIds([])

        setPanning(false)

        setDraggingNoteId(null)

        return
      }

      if (key === 's' && isMeta) {
        event.preventDefault()
        saveCurrentWorkspaceNow()

        return
      }

      // Ctrl+Tab / Ctrl+Shift+Tab:
      // cycle between open projects.
      // Browser-tab switching needs
      // Alt on most browsers, so this
      // is safe to intercept.
      if (key === 'tab' && isMeta && !event.altKey) {
        event.preventDefault()

        cycleProject(event.shiftKey ? -1 : 1)

        return
      }

      if (isEditableElement(event.target)) {
        return
      }

      // Delete / Backspace on selected
      // notes (single or multi): delete
      // immediately, no confirmation.
      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        effectiveSelectedNotes.length > 0 &&
        !selectedConnectionId
      ) {
        event.preventDefault()

        deleteSelectedNotes()

        return
      }

      // Delete / Backspace on a
      // selected connection: delete
      // it too.
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedConnectionId) {
        event.preventDefault()

        deleteSelectedConnection()
      }

      if (event.key === '?') {
        event.preventDefault()
        openHelp()

        return
      }

      if (isMeta && key === 'd' && !event.altKey) {
        event.preventDefault()

        if (selectedNoteIds.length > 1) {
          duplicateSelectedNotes()
        } else {
          duplicateSelectedNote()
        }

        return
      }

      if (key === 'c' && isMeta) {
        // Copying works even while the
        // note editor is open, as long
        // as no text inside it is
        // selected (that still copies
        // the text itself, like
        // anywhere else).
        const hasTextSelection = window.getSelection()?.toString()

        if (hasTextSelection && isEditableElement(event.target)) {
          return
        }

        event.preventDefault()

        if (selectedNoteIds.length > 1) {
          copySelectedNotesToClipboard()
        } else {
          copySelectedNoteToClipboard()
        }

        return
      }

      if (key === 'v' && isMeta) {
        event.preventDefault()

        pasteClipboardNote()

        return
      }

      if (isMeta && key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undoWorkspace()

        return
      }

      if ((isMeta && key === 'y') || (isMeta && event.shiftKey && key === 'z')) {
        event.preventDefault()
        redoWorkspace()

        return
      }

      if (!isMeta && !event.altKey && !event.shiftKey && key === 'n') {
        event.preventDefault()
        createNote()

        return
      }

      // AI CONTEXT cluster: A opens
      // the panel; Q/W/E copy the
      // current / connected / entire
      // scopes without opening it.
      // Typing in a text field still
      // wins: only fire when focus is
      // not inside an editable
      // element.
      if (
        !isMeta &&
        !event.altKey &&
        !event.shiftKey &&
        (key === 'a' || key === 'q' || key === 'w' || key === 'e')
      ) {
        if (isEditableElement(event.target)) {
          return
        }

        if (key === 'a') {
          event.preventDefault()

          openAiContextPanel()

          return
        }

        const scope: ContextScope = key === 'q' ? 'current' : key === 'w' ? 'connected' : 'entire'

        event.preventDefault()

        copyContext(scope)

        return
      }

      if (!isMeta && !event.altKey && !event.shiftKey && key === 'f') {
        if (effectiveSelectedNotes.length > 1) {
          event.preventDefault()

          centerOnNotes(effectiveSelectedNotes)
        } else if (selectedNote) {
          event.preventDefault()

          centerOnNote(selectedNote)
        }

        return
      }

      if (!isMeta && !event.altKey && !event.shiftKey && key === 'c') {
        if (selectedNote) {
          event.preventDefault()

          setConnectingNoteId(selectedNote.id)

          setSelectedConnectionId(null)
        }

        return
      }

      if (!isMeta && !event.ctrlKey && !event.altKey && !event.shiftKey && event.key === '0') {
        event.preventDefault()
        resetCanvasView()

        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    helpOpen,
    directoryPanelOpen,
    aiContextPanelOpen,
    noteDraft,
    workspaceEditorOpen,
    documentationEditorOpen,
    selectedConnectionId,
    selectedNote,
    workspace,
    projectDirectory,
    // Without this, the Ctrl+V
    // handler keeps the clipboard
    // value captured when the
    // listener was registered, so a
    // fresh Ctrl+C would never be
    // seen by it.
    clipboardNote,
    // Paste positions the copy at
    // the current viewport center.
    pan,
    zoom,
    // Ctrl+Tab cycles the real set
    // of open projects.
    backgroundProjects,
    // Bulk shortcuts track the
    // current multi-selection.
    selectedNoteIds,
    effectiveSelectedNotes,
  ])

  const editorStyle = {
    width: `${editorWidth}px`,
    maxWidth: 'calc(100vw - 24px)',
  }

  const renderFileTreeNode = (node: FileTreeNode, depth = 0, forceExpanded = false) => {
    if (node.kind === 'directory') {
      const isRoot = node.path === ''

      const isExpanded = isRoot || forceExpanded || expandedDirectories.has(node.path)

      const isLoading = directoryLoadingPath === node.path

      return (
        <div
          key={node.path || 'root'}
          className={isRoot ? 'file-tree-root' : 'file-tree-directory'}
        >
          {!isRoot && (
            <button
              type="button"
              className="file-tree-row file-tree-directory-row"
              style={{
                paddingLeft: `${12 + depth * 18}px`,
              }}
              onClick={() => loadDirectoryNode(node)}
            >
              <span className="file-tree-expander">{isLoading ? '…' : isExpanded ? '▾' : '▸'}</span>

              <span className="file-tree-icon">DIR</span>

              <span className="file-tree-name">{node.name}</span>
            </button>
          )}

          {isRoot && (
            <div className="file-tree-root-label">
              <span className="file-tree-icon">DIR</span>

              <strong>{node.name}</strong>
            </div>
          )}

          {isExpanded && node.children && node.children.length > 0 && (
            <div className="file-tree-children">
              {node.children.map((child) =>
                renderFileTreeNode(child, isRoot ? depth : depth + 1, forceExpanded),
              )}
            </div>
          )}

          {isExpanded && node.children?.length === 0 && !isRoot && (
            <div
              className="file-tree-empty"
              style={{
                paddingLeft: `${30 + depth * 18}px`,
              }}
            >
              —
            </div>
          )}
        </div>
      )
    }

    return (
      <button
        key={node.path}
        type="button"
        className={`file-tree-row file-tree-file-row ${
          selectedFilePath === node.path ? 'file-tree-file-selected' : ''
        }`}
        style={{
          paddingLeft: `${30 + depth * 18}px`,
        }}
        onClick={() => selectFileFromTree(node)}
        onDoubleClick={() => openProjectFile(node.path)}
      >
        <span className="file-tree-expander">·</span>

        <span className="file-tree-icon">FILE</span>

        <span className="file-tree-name">{node.name}</span>
      </button>
    )
  }

  const activeDirectoryTree = directorySearch.trim() ? directorySearchTree : directoryTree

  if (!workspace) {
    return (
      <LandingPage
        theme={theme}
        language={language}
        t={t}
        loading={loading}
        helpOpen={helpOpen}
        helpSearch={helpSearch}
        onLanguageChange={setLanguage}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onOpenHelp={openHelp}
        onHelpSearchChange={setHelpSearch}
        onCloseHelp={() => setHelpOpen(false)}
        onOpenProject={openProject}
      />
    )
  }

  return (
    <main className="app" data-theme={theme}>
      <WorkspaceTopBar
        theme={theme}
        language={language}
        t={t}
        onLanguageChange={setLanguage}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onOpenHelp={openHelp}
        projectName={projectName}
        onOpenDirectory={openDirectoryPanel}
        onOpenStatusStyles={openStatusStylePanel}
        projectSwitcher={
          workspace && projectDirectory ? (
            <ProjectSwitcher
              currentName={projectName ?? ''}
              backgroundProjects={backgroundProjects}
              t={t}
              onSwitchProject={switchToProject}
              onCloseBackgroundProject={removeBackgroundProject}
              onAddProject={openProject}
              onCloseCurrentProject={closeProject}
            />
          ) : undefined
        }
      />

      <div className={`workspace ${resizingSidebar ? 'sidebar-resizing' : ''}`}>
        <Sidebar
          t={t}
          workspace={workspace}
          creatingNote={creatingNote}
          sidebarVisible={sidebarVisible}
          sidebarWidth={sidebarWidth}
          selectedNote={selectedNote}
          aiContextStyles={aiContextStyles}
          onOpenAiContext={openAiContextPanel}
          onCopyAiContext={copyContext}
          onToggle={toggleSidebar}
          onStartResize={startSidebarResize}
          onCreateNote={createNote}
          onEditWorkspace={openWorkspaceEditor}
          onOpenDocumentation={openDocumentation}
          onEditDocumentation={openDocumentationEditor}
          onDeleteDocumentation={deleteDocumentation}
          onAddDocumentation={() => openDocumentationEditor()}
        />

        <div
          ref={canvasRef}
          className={`canvas ${panning ? 'canvas-panning' : ''}`}
          onMouseDown={(event) => {
            handleCanvasMouseDown(event)

            startMarquee(event)
          }}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={stopDraggingNote}
          onMouseLeave={stopDraggingNote}
          onWheel={handleCanvasWheel}
          onClick={() => {
            // A click right after a
            // marquee selection is the
            // browser-generated tail of
            // that same drag gesture, not
            // a fresh deselect click.
            if (Date.now() - marqueeEndedAtRef.current < 250) {
              return
            }

            if (!hasDraggedNote) {
              setSelectedConnectionId(null)

              setSelectedNoteId(null)

              setSelectedNoteIds([])
            }
          }}
        >
          <div
            className="canvas-world"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            }}
          >
            <div className="notes-layer">
              {workspace.notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  t={t}
                  language={language}
                  isSelected={selectedNoteId === note.id || selectedNoteIds.includes(note.id)}
                  isDragging={draggingNoteId === note.id}
                  isConnecting={connectingNoteId === note.id}
                  justCopied={copiedNoteId === note.id}
                  justPasted={pastedNoteId === note.id}
                  workspace={workspace}
                  projectDirectory={projectDirectory ?? undefined}
                  onNoteMouseDown={startDraggingNote}
                  onNoteClick={(event, noteItem) => {
                    event.stopPropagation()

                    if (event.shiftKey || event.ctrlKey || event.metaKey) {
                      // Shift, Ctrl and Cmd
                      // (macOS) all add/remove
                      // notes from the group.
                      toggleMultiSelectNote(noteItem.id)

                      return
                    }

                    if (selectedNoteIds.length > 0 && selectedNoteIds.includes(noteItem.id)) {
                      // Clicking one note of the
                      // group keeps the group;
                      // double-click opens it.
                      return
                    }
                    if (!hasDraggedNote) {
                      setSelectedNoteIds([])

                      openNote(noteItem)
                    }
                  }}
                />
              ))}
            </div>
          </div>

          {marquee && (
            <div
              className="marquee-rect"
              style={{
                left: `${Math.min(marquee.x0, marquee.x1)}px`,
                top: `${Math.min(marquee.y0, marquee.y1)}px`,
                width: `${Math.abs(marquee.x1 - marquee.x0)}px`,
                height: `${Math.abs(marquee.y1 - marquee.y0)}px`,
              }}
            />
          )}

          <ConnectionLayer
            notes={workspace.notes}
            connections={workspace.connections}
            selectedConnectionId={selectedConnectionId}
            onSelectConnection={(connectionId) => {
              setSelectedConnectionId(connectionId)

              setConnectingNoteId(null)
            }}
            onDeleteConnection={deleteConnection}
            zoom={zoom}
            pan={pan}
          />

          {workspace.notes.length === 0 && (
            <CanvasEmptyState t={t} creatingNote={creatingNote} onCreateNote={createNote} />
          )}

          {connectingNoteId && (
            <div className="connection-status">
              <span>{t('connect')}</span>

              <strong>{connectingNoteId.slice(0, 6)}</strong>

              <button
                onClick={(event) => {
                  event.stopPropagation()

                  setConnectingNoteId(null)
                }}
              >
                {t('cancel')}
              </button>
            </div>
          )}

          {selectedConnectionId && selectedConnection && (
            <div className="connection-status">
              <span>{t('connection')}</span>

              <strong>{selectedConnectionId.slice(0, 6)}</strong>

              <button
                onClick={(event) => {
                  event.stopPropagation()

                  deleteSelectedConnection()
                }}
              >
                {t('delete')}
              </button>

              <button
                onClick={(event) => {
                  event.stopPropagation()

                  setSelectedConnectionId(null)
                }}
              >
                {t('cancel')}
              </button>
            </div>
          )}

          <CanvasControls
            t={t}
            zoom={zoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={resetCanvasView}
          />

          <button
            className="floating-create"
            onClick={createNote}
            disabled={creatingNote}
            aria-label={t('createNoteAria')}
          >
            +
          </button>
        </div>

        {selectedNote && noteDraft && (
          <NoteEditor
            t={t}
            language={language}
            noteDraft={noteDraft}
            selectTitleOnOpen={noteEditorSelectTitle}
            editorStyle={editorStyle}
            confirmingDelete={confirmingDelete}
            savingNote={savingNote}
            addingFiles={addingFiles}
            openingFilePath={openingFilePath}
            onStartResize={startEditorResize}
            onClose={closeNoteEditor}
            onOpenStatusStyles={() => setStatusStylePanelOpen(true)}
            projectDirectory={projectDirectory ?? undefined}
            workspace={workspace}
            onUpdateNoteDraft={updateNoteDraft}
            onApplyNoteDraftChange={applyNoteDraftChange}
            onAddFiles={addFilesToNote}
            onOpenProjectFile={openProjectFile}
            onRemoveFile={removeFileFromNote}
            onSave={saveNote}
            onSetConfirmingDelete={setConfirmingDelete}
            onDeleteNote={deleteNote}
          />
        )}

        {workspaceEditorOpen && (
          <WorkspaceEditor
            t={t}
            editorStyle={editorStyle}
            projectName={projectName}
            workspaceTitleDraft={workspaceTitleDraft}
            workspaceDescriptionDraft={workspaceDescriptionDraft}
            savingWorkspaceInfo={savingWorkspaceInfo}
            onTitleDraftChange={setWorkspaceTitleDraft}
            onDescriptionDraftChange={setWorkspaceDescriptionDraft}
            onClose={closeWorkspaceEditor}
            onSave={saveWorkspaceInfo}
            onStartResize={startEditorResize}
          />
        )}

        {documentationEditorOpen && documentationDraft && (
          <DocumentationEditor
            t={t}
            editorStyle={editorStyle}
            documentationDraft={documentationDraft}
            documentationExists={workspace.documentation.some(
              (item) => item.id === documentationDraft.id,
            )}
            savingDocumentation={savingDocumentation}
            onDraftChange={setDocumentationDraft}
            onClose={closeDocumentationEditor}
            onSave={saveDocumentation}
            onDelete={() => deleteDocumentation(documentationDraft.id)}
            onStartResize={startEditorResize}
          />
        )}

        {aiContextPanelOpen && (
          <AiContextPanel
            t={t}
            workspace={workspace}
            selectedNote={selectedNote}
            selectedNoteId={selectedNoteId}
            selectedNoteCount={selectedNoteIds.length}
            aiContextStyles={aiContextStyles}
            copiedContext={copiedContext}
            aiContextDraft={aiContextDraft}
            savingAiContext={savingAiContext}
            onAiContextDraftChange={setAiContextDraft}
            onCopyContext={copyContext}
            onClose={closeAiContextPanel}
            onSave={saveAiContext}
          />
        )}

        {directoryPanelOpen && (
          <DirectoryPanel
            t={t}
            language={language}
            directorySearch={directorySearch}
            directorySearching={directorySearching}
            directoryLoading={directoryLoading}
            activeDirectoryTree={activeDirectoryTree}
            forceExpanded={Boolean(directorySearch.trim())}
            selectedFileInfo={selectedFileInfo}
            openingFilePath={openingFilePath}
            onDirectorySearchChange={setDirectorySearch}
            onRefresh={refreshDirectory}
            onRenderFileTreeNode={renderFileTreeNode}
            onOpenProjectFile={openProjectFile}
            onClose={closeDirectoryPanel}
          />
        )}

        {statusStylePanelOpen && (
          <StatusStylePanel
            t={t}
            workspace={workspace}
            onConfigureStatus={configureStatusStyle}
            onClose={() => setStatusStylePanelOpen(false)}
          />
        )}

        {helpOpen && (
          <HelpOverlay
            t={t}
            helpSearch={helpSearch}
            onHelpSearchChange={setHelpSearch}
            onClose={() => setHelpOpen(false)}
          />
        )}
      </div>

      <footer className="footer">
        <span>BRUTO / {projectName?.toUpperCase()}</span>

        <span>
          {workspace.notes.length} {t('notes')}
        </span>
      </footer>
    </main>
  )
}

function getStoredSidebarVisible(): boolean {
  return localStorage.getItem('bruto-sidebar-visible') !== 'false'
}

function getStoredSidebarWidth(): number {
  const stored = localStorage.getItem('bruto-sidebar-width')

  const parsed = stored ? Number.parseInt(stored, 10) : Number.NaN

  if (Number.isNaN(parsed)) {
    return 250
  }

  return Math.min(560, Math.max(190, parsed))
}

interface ProjectSwitcherProps {
  /** Name of the project on
   * screen right now. */
  currentName: string
  /** Stashed projects, switchable
   * from the header menu. */
  backgroundProjects: BackgroundProject[]
  t: (key: TranslationKey) => string
  onSwitchProject: (project: BackgroundProject) => void
  onCloseBackgroundProject: (project: BackgroundProject) => void
  onAddProject: () => void
  onCloseCurrentProject: () => void
}

function ProjectSwitcher({
  currentName,
  backgroundProjects,
  t,
  onSwitchProject,
  onCloseBackgroundProject,
  onAddProject,
  onCloseCurrentProject,
}: ProjectSwitcherProps) {
  const [open, setOpen] = useState(false)

  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)

      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className="project-switcher" ref={rootRef}>
      <button
        type="button"
        className={`project-switcher-trigger ${open ? 'project-switcher-trigger-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>/ {currentName}</span>

        <span className="project-switcher-caret">▾</span>
      </button>

      {open && (
        <div className="project-switcher-menu" role="menu">
          {backgroundProjects.map((project) => (
            <div key={project.name} className="project-switcher-row-group">
              <button
                type="button"
                role="menuitem"
                className="project-switcher-row"
                onClick={() => {
                  onSwitchProject(project)

                  setOpen(false)
                }}
              >
                <span className="project-switcher-name">{project.name}</span>
              </button>

              <button
                type="button"
                className="project-switcher-close"
                aria-label={t('closeProject')}
                title={t('closeProject')}
                onClick={(event) => {
                  event.stopPropagation()

                  onCloseBackgroundProject(project)

                  setOpen(false)
                }}
              >
                ✕
              </button>
            </div>
          ))}

          {backgroundProjects.length > 0 && <div className="project-switcher-separator" />}

          <button
            type="button"
            role="menuitem"
            className="project-switcher-row project-switcher-add"
            onClick={() => {
              onAddProject()

              setOpen(false)
            }}
          >
            + {t('addProject')}
          </button>

          <div className="project-switcher-separator" />

          <button
            type="button"
            role="menuitem"
            className="project-switcher-row project-switcher-close-current"
            onClick={() => {
              onCloseCurrentProject()

              setOpen(false)
            }}
          >
            ✕ {t('closeProject')}
          </button>
        </div>
      )}
    </div>
  )
}

export default App
