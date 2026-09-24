import { useCallback, useEffect, useRef, useState } from 'react'
import type { Workspace } from '../types'
import {
  ensureReadWrite,
  forgetProject,
  listRecentProjects,
  rememberProject,
  type RecentProject,
} from '../storage/recentProjects'
import { createWorkspaceIO, loadWorkspace, projectTitle, restoreWorkspace } from './projectLoader'
import { createWorkspaceStore, type WorkspaceStore } from './workspaceStore'
import { createWorkspaceSync, type SaveStatus, type WorkspaceSync } from './workspaceSync'

export interface ProjectTab {
  id: string
  name: string
  handle: FileSystemDirectoryHandle
}

export interface ActiveProject extends ProjectTab {
  store: WorkspaceStore
  sync: WorkspaceSync
}

export interface Recovery {
  tab: ProjectTab
  error: string
  backup: { name: string; workspace: Workspace } | null
}

interface Options {
  onExternalChange: () => void
  onError: (error: unknown) => void
}

const DISK_CHECK_INTERVAL = 1500

export const supportsFileSystemAccess = () => 'showDirectoryPicker' in window

/**
 * Open projects, the one on screen and the recent list. Only the active
 * project is kept in memory; switching always re-reads the disk, so what you
 * see is never an old copy.
 */
export function useProjects({ onExternalChange, onError }: Options) {
  const [tabs, setTabs] = useState<ProjectTab[]>([])
  const [active, setActive] = useState<ActiveProject | null>(null)
  const [recovery, setRecovery] = useState<Recovery | null>(null)
  const [recents, setRecents] = useState<RecentProject[]>([])
  const [loading, setLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'saved' })

  const activeRef = useRef(active)
  const callbacks = useRef({ onExternalChange, onError })

  useEffect(() => {
    activeRef.current = active
    callbacks.current = { onExternalChange, onError }
  })

  const refreshRecents = useCallback(() => {
    void listRecentProjects().then(setRecents)
  }, [])

  useEffect(refreshRecents, [refreshRecents])

  /** Saves and releases the project on screen. */
  const leaveActive = useCallback(async () => {
    const current = activeRef.current

    if (!current) return

    await current.sync.saveNow()
    current.sync.dispose()
    activeRef.current = null
    setActive(null)
  }, [])

  const load = useCallback(async (tab: ProjectTab) => {
    const result = await loadWorkspace(tab.handle)

    if (result.kind === 'invalid') {
      setRecovery({ tab, error: result.error, backup: result.backup })
      return
    }

    const store = createWorkspaceStore(result.workspace)
    const sync = createWorkspaceSync({
      store,
      io: createWorkspaceIO(tab.handle),
      diskText: result.diskText,
      onStatus: setSaveStatus,
      onExternalChange: () => callbacks.current.onExternalChange(),
    })

    const project = { ...tab, store, sync }

    activeRef.current = project
    setRecovery(null)
    setSaveStatus({ kind: 'saved' })
    setActive(project)
    setTabs((current) => (current.some((item) => item.id === tab.id) ? current : [...current, tab]))
  }, [])

  const open = useCallback(
    async (handle: FileSystemDirectoryHandle) => {
      setLoading(true)

      try {
        if (!(await ensureReadWrite(handle))) return

        for (const tab of tabs) {
          if (await tab.handle.isSameEntry(handle)) {
            if (activeRef.current?.id !== tab.id) {
              await leaveActive()
              await load(tab)
            }

            return
          }
        }

        const recent = await rememberProject(handle)

        await leaveActive()
        await load({ id: recent.id, name: projectTitle(handle), handle })
        refreshRecents()
      } catch (error) {
        callbacks.current.onError(error)
      } finally {
        setLoading(false)
      }
    },
    [tabs, leaveActive, load, refreshRecents],
  )

  const openPicker = useCallback(async () => {
    try {
      await open(await window.showDirectoryPicker({ id: 'bruto', mode: 'readwrite' }))
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        callbacks.current.onError(error)
      }
    }
  }, [open])

  const switchTo = useCallback(
    async (id: string) => {
      const tab = tabs.find((item) => item.id === id)

      if (!tab || activeRef.current?.id === id) return

      setLoading(true)

      try {
        await leaveActive()
        await load(tab)
      } catch (error) {
        callbacks.current.onError(error)
      } finally {
        setLoading(false)
      }
    },
    [tabs, leaveActive, load],
  )

  const close = useCallback(
    async (id: string) => {
      const remaining = tabs.filter((tab) => tab.id !== id)

      setTabs(remaining)

      if (activeRef.current?.id !== id) return

      await leaveActive()

      if (remaining[0]) await load(remaining[0]).catch(callbacks.current.onError)
    },
    [tabs, leaveActive, load],
  )

  const forgetRecent = useCallback(
    async (id: string) => {
      await forgetProject(id)
      refreshRecents()
    },
    [refreshRecents],
  )

  const retryRecovery = useCallback(async () => {
    if (!recovery) return

    setLoading(true)
    await load(recovery.tab).catch(callbacks.current.onError)
    setLoading(false)
  }, [recovery, load])

  const restoreBackup = useCallback(async () => {
    if (!recovery?.backup) return

    setLoading(true)

    try {
      await restoreWorkspace(recovery.tab.handle, recovery.backup.workspace)
      await load(recovery.tab)
    } catch (error) {
      callbacks.current.onError(error)
    } finally {
      setLoading(false)
    }
  }, [recovery, load])

  const cancelRecovery = useCallback(async () => {
    const tab = recovery?.tab

    setRecovery(null)

    const fallback = tabs.find((item) => item.id !== tab?.id)

    setTabs((current) => current.filter((item) => item.id !== tab?.id))

    if (fallback) await load(fallback).catch(callbacks.current.onError)
  }, [recovery, tabs, load])

  // Keep the active project in sync with the disk while it is on screen.
  useEffect(() => {
    if (!active) return

    const check = () => {
      if (document.visibilityState === 'visible') void active.sync.checkDisk()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void active.sync.saveNow()
      else check()
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      const status = active.sync.getStatus().kind

      if (active.store.getSnapshot().dirty || status === 'saving') {
        void active.sync.saveNow()
        event.preventDefault()
      }
    }

    const interval = window.setInterval(check, DISK_CHECK_INTERVAL)

    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [active])

  return {
    tabs,
    active,
    recovery,
    recents,
    loading,
    saveStatus,
    open,
    openPicker,
    switchTo,
    close,
    forgetRecent,
    retryRecovery,
    restoreBackup,
    cancelRecovery,
  }
}

export type Projects = ReturnType<typeof useProjects>
