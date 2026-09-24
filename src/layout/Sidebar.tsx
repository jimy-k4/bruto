import type { ContextScope, Note, NoteStatus, Workspace, WorkspaceDocumentation } from '../types'
import { NOTE_STATUSES } from '../domain/constants'
import { getConnectedNoteIds, noteTitle } from '../domain/workspace'
import { statusLabel, useI18n, type TranslationKey } from '../i18n'
import { isBoolean, isNumberBetween, usePreference } from '../preferences'
import { ContextStrips } from '../ui/ContextStrips'

interface SidebarProps {
  workspace: Workspace
  selectedNotes: Note[]
  copiedScope: ContextScope | null
  onEditWorkspace: () => void
  onOpenAiContext: () => void
  onCopyContext: (scope: ContextScope) => void
  onAddDocumentation: () => void
  onEditDocumentation: (documentation: WorkspaceDocumentation) => void
  onRemoveDocumentation: (documentation: WorkspaceDocumentation) => void
  onSelectStatus: (status: NoteStatus) => void
}

const MIN_WIDTH = 200
const MAX_WIDTH = 520

const DOCUMENTATION_TYPE_KEYS: Record<WorkspaceDocumentation['type'], TranslationKey> = {
  obsidian: 'documentationTypeObsidian',
  notion: 'documentationTypeNotion',
  web: 'documentationTypeWeb',
  other: 'documentationTypeOther',
}

export function Sidebar(props: SidebarProps) {
  const { t } = useI18n()
  const [visible, setVisible] = usePreference('bruto-sidebar-visible', true, isBoolean)
  const [width, setWidth] = usePreference(
    'bruto-sidebar-width',
    260,
    isNumberBetween(MIN_WIDTH, MAX_WIDTH),
  )

  if (!visible) {
    return (
      <button
        type="button"
        className="sidebar-tab"
        onClick={() => setVisible(true)}
        aria-label={t('showSidebar')}
        title={t('showSidebar')}
      >
        »
      </button>
    )
  }

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()

    const handle = event.currentTarget
    const startX = event.clientX
    const startWidth = width

    handle.setPointerCapture(event.pointerId)

    const move = (moveEvent: PointerEvent) => {
      setWidth(
        Math.round(
          Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + moveEvent.clientX - startX)),
        ),
      )
    }

    const stop = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', stop)
    }

    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', stop)
  }

  return (
    <aside className="sidebar" style={{ width }} aria-label={t('projectPanel')}>
      <button
        type="button"
        className="icon-button sidebar__hide"
        onClick={() => setVisible(false)}
        aria-label={t('hideSidebar')}
        title={t('hideSidebar')}
      >
        «
      </button>

      <div className="sidebar__scroll">
        <ProjectSection {...props} />
        <AiSection {...props} />
        <DocumentationSection {...props} />
        <StatusSection {...props} />
      </div>

      <div
        className="sidebar__resize"
        role="separator"
        aria-orientation="vertical"
        aria-label={t('resizePanel')}
        onPointerDown={startResize}
      />
    </aside>
  )
}

function ProjectSection({ workspace, onEditWorkspace }: SidebarProps) {
  const { t } = useI18n()

  return (
    <section className="sidebar__section">
      <h2 className="eyebrow">{t('project')}</h2>
      <p className="sidebar__title">{workspace.title}</p>
      <p className="sidebar__text">{workspace.description || t('noDescription')}</p>

      <button type="button" className="button button--block" onClick={onEditWorkspace}>
        {t('editProject')}
      </button>
    </section>
  )
}

function AiSection({
  workspace,
  selectedNotes,
  copiedScope,
  onOpenAiContext,
  onCopyContext,
}: SidebarProps) {
  const { t } = useI18n()
  const hasSelection = selectedNotes.length > 0

  const connectedNotes = hasSelection
    ? [...new Set(selectedNotes.flatMap((note) => [...getConnectedNoteIds(workspace, note.id)]))]
        .filter((id) => !selectedNotes.some((note) => note.id === id))
        .map((id) => workspace.notes.find((note) => note.id === id)!)
        .filter(Boolean)
    : []

  const copyButton = (scope: ContextScope, label: TranslationKey, key: string, notes: Note[]) => (
    <button
      type="button"
      className="context-button"
      disabled={scope !== 'entire' && !hasSelection}
      onClick={() => onCopyContext(scope)}
    >
      <ContextStrips notes={notes} />
      <span className="context-button__label">
        {copiedScope === scope ? t('copied') : t(label)}
      </span>
      <kbd>{key}</kbd>
    </button>
  )

  return (
    <section className="sidebar__section">
      <h2 className="eyebrow">{t('aiContext')}</h2>

      <div className="sidebar__selection">
        <span className="eyebrow">{t('selection')}</span>
        <strong>
          {selectedNotes.length === 0
            ? t('nothingSelected')
            : selectedNotes.length === 1
              ? noteTitle(selectedNotes[0], t('untitled'))
              : t('notesCount', { count: selectedNotes.length })}
        </strong>
      </div>

      <button
        type="button"
        className="button button--primary button--block"
        onClick={onOpenAiContext}
      >
        {t('openAiContext')} <kbd>A</kbd>
      </button>

      <div className="sidebar__stack">
        {copyButton('current', 'copyCurrent', 'Q', selectedNotes)}
        {copyButton('connected', 'copyConnected', 'W', connectedNotes)}
        {copyButton('entire', 'copyEntire', 'E', [])}
      </div>
    </section>
  )
}

function DocumentationSection({
  workspace,
  onAddDocumentation,
  onEditDocumentation,
  onRemoveDocumentation,
}: SidebarProps) {
  const { t } = useI18n()

  return (
    <section className="sidebar__section">
      <h2 className="eyebrow">{t('documentation')}</h2>

      {workspace.documentation.length === 0 ? (
        <p className="sidebar__text">{t('noDocumentation')}</p>
      ) : (
        <ul className="doc-list">
          {workspace.documentation.map((item) => (
            <li key={item.id} className="doc-list__item">
              <a
                className="doc-list__link"
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="eyebrow">{t(DOCUMENTATION_TYPE_KEYS[item.type])}</span>
                <strong>{item.name}</strong>
                <span className="doc-list__url">{item.url}</span>
              </a>

              <div className="doc-list__actions">
                <button
                  type="button"
                  className="button button--small"
                  onClick={() => onEditDocumentation(item)}
                >
                  {t('edit')}
                </button>
                <button
                  type="button"
                  className="icon-button icon-button--small"
                  onClick={() => onRemoveDocumentation(item)}
                  aria-label={t('removeItem', { name: item.name })}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="button button--block" onClick={onAddDocumentation}>
        + {t('addDocumentation')}
      </button>
    </section>
  )
}

/** Notes per status. Clicking a status selects its notes on the board. */
function StatusSection({ workspace, onSelectStatus }: SidebarProps) {
  const { t } = useI18n()
  const counts = NOTE_STATUSES.map((status) => ({
    status,
    count: workspace.notes.filter((note) => note.status === status).length,
  })).filter((item) => item.count > 0)

  return (
    <section className="sidebar__section">
      <h2 className="eyebrow">{t('content')}</h2>

      <p className="sidebar__text">
        {t('notesCount', { count: workspace.notes.length })} ·{' '}
        {t('connectionsCount', { count: workspace.connections.length })}
      </p>

      {counts.length > 0 && (
        <ul className="status-list">
          {counts.map(({ status, count }) => (
            <li key={status}>
              <button
                type="button"
                className="status-list__item"
                onClick={() => onSelectStatus(status)}
                title={t('selectStatusNotes')}
              >
                <span className={`status-badge status-badge--${status}`}>
                  {statusLabel(t, status)}
                </span>
                <span>{count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
