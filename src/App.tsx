import { useState } from 'react'
import { useI18n } from './i18n'
import { I18nProvider } from './i18n/I18nProvider'
import { Landing } from './layout/Landing'
import { RecoveryScreen } from './layout/RecoveryScreen'
import { HelpDialog } from './panels/HelpDialog'
import { useTheme } from './preferences'
import { supportsFileSystemAccess, useProjects } from './state/useProjects'
import { ToastProvider } from './ui/ToastProvider'
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
  const { t } = useI18n()
  const toast = useToast()
  const [theme, toggleTheme] = useTheme()
  const [helpOpen, setHelpOpen] = useState(false)

  const projects = useProjects({
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
        loading={projects.loading}
        recents={projects.recents}
        onOpenFolder={() => void projects.openPicker()}
        onOpenRecent={(recent) => void projects.open(recent.handle)}
        onForgetRecent={(recent) => void projects.forgetRecent(recent.id)}
      />

      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </>
  )
}
