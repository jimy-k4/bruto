import { useEffect } from 'react'
import { matchShortcut, type ShortcutAction } from '../shortcuts/keymap'
import type { Projects } from '../state/useProjects'
import { isImageFile } from '../storage/projectFiles'
import { isEditable } from '../ui/focus'
import { useStableCallback } from '../ui/useStableCallback'
import type { WorkspaceActions } from './workspaceActions'
import type { WorkspaceUi } from './useWorkspaceUi'

/** Keyboard shortcuts and system clipboard (copy/paste) for the open workspace. */
export function useWorkspaceShortcuts(
  actions: WorkspaceActions,
  ui: WorkspaceUi,
  projects: Projects,
) {
  const run = (action: ShortcutAction, key: string) => {
    const ids = ui.selectedIds

    switch (action) {
      case 'newNote':
        return actions.createNote()
      case 'openAiContext':
        return ui.setModal('ai')
      case 'copyCurrent':
        return actions.copyContext('current')
      case 'copyConnected':
        return actions.copyContext('connected')
      case 'copyEntire':
        return actions.copyContext('entire')
      case 'center':
        return actions.center()
      case 'connect':
        if (ids.length === 1) ui.setConnectingFrom(ids[0])
        return
      case 'resetView':
        return actions.resetView()
      case 'selectAll':
        return actions.selectAll()
      case 'duplicate':
        return actions.duplicate(ids)
      case 'delete':
        if (ui.selectedConnectionId) return actions.deleteConnection(ui.selectedConnectionId)
        return actions.deleteNotes(ids)
      case 'undo':
        return actions.undo()
      case 'redo':
        return actions.redo()
      case 'save':
        return actions.save()
      case 'help':
        return ui.setModal('help')
      case 'switchProject': {
        const tab = projects.tabs[Number(key) - 1]
        if (tab) void projects.switchTo(tab.id)
        return
      }
      case 'escape':
        if (ui.side) return ui.setSide(null)
        if (ui.connectingFrom) return ui.setConnectingFrom(null)
        if (ui.selectedConnectionId) return ui.setSelectedConnectionId(null)
        return ui.clearSelection()
    }
  }

  const onKeyDown = useStableCallback((event: KeyboardEvent) => {
    // Holding a key down repeats only movement, never actions like "new note".
    if (event.defaultPrevented || event.repeat) return

    const match = matchShortcut(event)

    if (!match) return

    const typing = isEditable(event.target)
    const inDialog =
      Boolean(ui.modal) ||
      (event.target instanceof Element && event.target.closest('[role="dialog"]'))

    // Board shortcuts never fire while typing or while a window is open.
    if (match.scope === 'board' && (typing || inDialog)) return
    // Escape while typing in a side panel is handled by the panel itself.
    if (match.action === 'escape' && (typing || inDialog)) return

    event.preventDefault()
    void run(match.action, match.key)
  })

  const onCopy = useStableCallback((event: ClipboardEvent) => {
    const selectedText = window.getSelection()?.toString()

    if (ui.modal || isEditable(event.target) || selectedText || ui.selectedIds.length === 0) return

    const markdown = actions.copyNotes(ui.selectedIds)

    if (markdown) {
      event.preventDefault()
      // Pasting outside Bruto (a chat, an editor) gives the notes as Markdown.
      event.clipboardData?.setData('text/plain', markdown)
    }
  })

  const onPaste = useStableCallback((event: ClipboardEvent) => {
    const images = [...(event.clipboardData?.files ?? [])].filter(isImageFile)
    const editingId = ui.editingNote?.id

    if (images.length > 0) {
      if (editingId) {
        event.preventDefault()
        void actions.addImages(editingId, images)
        return
      }

      if (ui.modal || isEditable(event.target)) return

      event.preventDefault()

      if (ui.selectedIds.length === 1) void actions.addImages(ui.selectedIds[0], images)
      else void actions.createNoteWithImages(images)

      return
    }

    if (ui.modal || isEditable(event.target)) return

    event.preventDefault()
    actions.pasteNotes()
  })

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('copy', onCopy)
    document.addEventListener('paste', onPaste)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('paste', onPaste)
    }
  }, [onKeyDown, onCopy, onPaste])
}
