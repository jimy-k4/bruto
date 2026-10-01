import { useEffect, useEffectEvent, useState } from 'react'
import { createDemoProject, supportsDemo, takeDemoLink } from './demo/demoProject'
import { noteTitle } from './domain/workspace'
import { fieldLabel } from './ui/agentStamp'
import { track } from './ui/analytics'
import { useI18n } from './i18n'
import { I18nProvider } from './i18n/I18nProvider'
import { Landing } from './layout/Landing'
import { RecoveryScreen } from './layout/RecoveryScreen'
import { HelpDialog } from './panels/HelpDialog'
import { PrivacyDialog } from './panels/PrivacyDialog'
import { useLook, useTheme } from './preferences'
import { supportsFileSystemAccess, useProjects, type Projects } from './state/useProjects'
import { ToastProvider } from './ui/ToastProvider'
import { UpdateNotice } from './ui/UpdateNotice'
import { useToast } from './ui/toasts'
import { WorkspaceScreen } from './workspace/WorkspaceScreen'

const LANDING_TITLE = document.title

export default function App() {
  return (
    <I18nProvider>
      <ToastProvider>
        <Root />
      </ToastProvider>
    </I18nProvider>
  )
}

function Root() {
  const projects = useAppProjects()

  // Saved first, so reloading never asks "leave the page?" over pending changes.
  const reload = async () => {
    try {
      await projects.active?.sync.saveNow()
    } finally {
      window.location.reload()
    }
  }

  return (
    <>
      <Screen projects={projects} />
      <UpdateNotice onReload={() => void reload()} />
    </>
  )
}

function useAppProjects() {
  const { t } = useI18n()
  const toast = useToast()

  return useProjects({
    onExternalChange: ({ conflicts, workspace, keepTheirs }) => {
      if (conflicts.length === 0) {
        toast({ message: t('externalChangesMerged') })
        return
      }

      // Both sides changed the same thing: yours stayed, and you get to know it, and to undo that.
      const [first] = conflicts
      const note = workspace.notes.find((item) => item.id === first.noteId)

      toast({
        message:
          conflicts.length === 1
            ? t('externalConflict', {
                who: note?.agent?.client ?? t('anotherTool'),
                note: note ? noteTitle(note, t('untitled')) : first.noteId,
                field: fieldLabel(t, first.field),
              })
            : t('externalConflicts', { count: conflicts.length }),
        action: { label: t('keepTheirs'), run: keepTheirs },
        duration: 12000,
      })
    },
    onError: (error) => {
      console.error(error)
      toast({
        tone: 'error',
        message:
          error instanceof DOMException && error.name === 'NotAllowedError'
            ? t('permissionDenied')
            : t('unexpectedError', {
                message: error instanceof Error ? error.message : String(error),
              }),
      })
    },
  })
}

function Screen({ projects }: { projects: Projects }) {
  const [theme, toggleTheme] = useTheme()
  const [look, toggleLook] = useLook()
  const [helpOpen, setHelpOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const { t, language } = useI18n()
  const toast = useToast()

  // A fresh copy of the example project each time, in the reader's language.
  const tryDemo = async (from: 'button' | 'link') => {
    try {
      await projects.open(await createDemoProject(language))
      track('demo-open', { from })
    } catch (error) {
      console.error(error)
      toast({ tone: 'error', message: t('demoFailed') })
    }
  }

  // A link with ?demo, like the "Live demo" of a launch page, skips the landing page.
  const openLinkedDemo = useEffectEvent(() => {
    if (takeDemoLink() && supportsDemo()) void tryDemo('link')
  })

  useEffect(() => openLinkedDemo(), [])

  // The landing page keeps the descriptive title from index.html; an open project names the tab.
  const projectName = projects.active?.name

  useEffect(() => {
    document.title = projectName ? `${projectName.toUpperCase()} · BRUTO` : LANDING_TITLE
  }, [projectName])

  if (projects.recovery) {
    return (
      <RecoveryScreen
        recovery={projects.recovery}
        loading={projects.loading}
        onRetry={() => void projects.retryRecovery()}
        onRestore={() => void projects.restoreBackup()}
        onCancel={() => void projects.cancelRecovery()}
      />
    )
  }

  if (projects.active) {
    return (
      <WorkspaceScreen
        key={projects.active.id}
        project={projects.active}
        projects={projects}
        theme={theme}
        onToggleTheme={toggleTheme}
        look={look}
        onToggleLook={toggleLook}
      />
    )
  }

  return (
    <>
      <Landing
        theme={theme}
        onToggleTheme={toggleTheme}
        look={look}
        onToggleLook={toggleLook}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenPrivacy={() => setPrivacyOpen(true)}
        supported={supportsFileSystemAccess()}
        demoSupported={supportsDemo()}
        loading={projects.loading}
        recents={projects.recents}
        onOpenFolder={() => void projects.openPicker()}
        onTryDemo={() => void tryDemo('button')}
        onOpenRecent={(recent) => {
          track('project-reopen')
          void projects.open(recent.handle)
        }}
        onForgetRecent={(recent) => void projects.forgetRecent(recent.id)}
      />

      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      {privacyOpen && <PrivacyDialog onClose={() => setPrivacyOpen(false)} />}
    </>
  )
}
