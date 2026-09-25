import { useState } from 'react'
import { createDemoProject, supportsDemo } from './demo/demoProject'
import { useI18n } from './i18n'
import { I18nProvider } from './i18n/I18nProvider'
import { Landing } from './layout/Landing'
import { RecoveryScreen } from './layout/RecoveryScreen'
import { HelpDialog } from './panels/HelpDialog'
import { useTheme } from './preferences'
import { supportsFileSystemAccess, useProjects, type Projects } from './state/useProjects'
import { ToastProvider } from './ui/ToastProvider'
import { UpdateNotice } from './ui/UpdateNotice'
import { useToast } from './ui/toasts'
import { WorkspaceScreen } from './workspace/WorkspaceScreen'

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
    onExternalChange: () => toast({ message: t('externalChangesMerged') }),
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
  const [helpOpen, setHelpOpen] = useState(false)
  const { t, language } = useI18n()
  const toast = useToast()

  // A fresh copy of the example project each time, in the reader's language.
  const tryDemo = async () => {
    try {
      await projects.open(await createDemoProject(language))
    } catch (error) {
      console.error(error)
      toast({ tone: 'error', message: t('demoFailed') })
    }
  }

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
      />
    )
  }

  return (
    <>
      <Landing
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenHelp={() => setHelpOpen(true)}
        supported={supportsFileSystemAccess()}
        demoSupported={supportsDemo()}
        loading={projects.loading}
        recents={projects.recents}
        onOpenFolder={() => void projects.openPicker()}
        onTryDemo={() => void tryDemo()}
        onOpenRecent={(recent) => void projects.open(recent.handle)}
        onForgetRecent={(recent) => void projects.forgetRecent(recent.id)}
      />

      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </>
  )
}
