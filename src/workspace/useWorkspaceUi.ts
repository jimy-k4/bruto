import { useCallback, useMemo, useRef, useState } from 'react'
import type { ContextScope, Note, Workspace, WorkspaceDocumentation } from '../types'
import type { NoteFlash } from '../board/NoteCard'
import type { WorkspaceStore } from '../state/workspaceStore'

export type SidePanelState =
  | { kind: 'note'; id: string; focusTitle: boolean }
  | { kind: 'bulk' }
  | { kind: 'workspace' }
  | { kind: 'documentation'; documentation: WorkspaceDocumentation; isNew: boolean }
  | null

export type ModalState = 'ai' | 'files' | 'styles' | 'help' | null

/**
 * Everything on screen that isn't saved in the workspace: selection, open
 * panels, connection mode and short-lived feedback.
 */
export function useWorkspaceUi(workspace: Workspace, store: WorkspaceStore) {
  const [rawSelection, setRawSelection] = useState<string[]>([])
  const [side, setSideState] = useState<SidePanelState>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null)
  const [flash, setFlashState] = useState<{ ids: string[]; kind: Exclude<NoteFlash, null> } | null>(
    null,
  )
  const [copiedScope, setCopiedScopeState] = useState<ContextScope | null>(null)
  const timers = useRef<{ flash?: number; copied?: number }>({})

  // Notes deleted by undo or by another tool drop out of the selection.
  const selectedIds = useMemo(() => {
    const existing = new Set(workspace.notes.map((note) => note.id))

    return rawSelection.filter((id) => existing.has(id))
  }, [rawSelection, workspace.notes])

  const selectedNotes = useMemo(
    () => workspace.notes.filter((note) => selectedIds.includes(note.id)),
    [workspace.notes, selectedIds],
  )

  const editingNote: Note | undefined =
    side?.kind === 'note' ? workspace.notes.find((note) => note.id === side.id) : undefined

  /** Each opened panel is its own undo step: typing is grouped per panel. */
  const setSide = useCallback(
    (next: SidePanelState) => {
      store.endGroup()
      setSideState(next)
    },
    [store],
  )

  const select = useCallback(
    (ids: string[], options: { open?: boolean; focusEditor?: boolean } = {}) => {
      setRawSelection(ids)
      setSelectedConnectionId(null)

      if (options.open && ids.length === 1) {
        setSide({ kind: 'note', id: ids[0], focusTitle: Boolean(options.focusEditor) })
      } else {
        setSideState((current) => {
          if (current?.kind === 'note' && !ids.includes(current.id)) return null
          if (current?.kind === 'bulk' && ids.length < 2) return null

          return current
        })
      }
    },
    [setSide],
  )

  const toggleSelect = useCallback((id: string) => {
    setSelectedConnectionId(null)
    setRawSelection((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }, [])

  const clearSelection = useCallback(() => select([]), [select])

  const flashNotes = useCallback((ids: string[], kind: Exclude<NoteFlash, null>) => {
    window.clearTimeout(timers.current.flash)
    setFlashState({ ids, kind })
    timers.current.flash = window.setTimeout(
      () => setFlashState(null),
      kind === 'copied' ? 900 : 500,
    )
  }, [])

  const markCopied = useCallback((scope: ContextScope) => {
    window.clearTimeout(timers.current.copied)
    setCopiedScopeState(scope)
    timers.current.copied = window.setTimeout(() => setCopiedScopeState(null), 1800)
  }, [])

  return {
    selectedIds,
    selectedNotes,
    editingNote,
    side,
    setSide,
    modal,
    setModal,
    connectingFrom,
    setConnectingFrom,
    selectedConnectionId,
    setSelectedConnectionId,
    flash,
    flashNotes,
    copiedScope,
    markCopied,
    select,
    toggleSelect,
    clearSelection,
  }
}

export type WorkspaceUi = ReturnType<typeof useWorkspaceUi>
