import { Suspense, lazy, useEffect, useMemo, useSyncExternalStore } from 'react'
import { track } from '../ui/analytics'
import type { AppTheme } from '../types'
import { Board } from '../board/Board'
import { BoardSearch } from '../board/BoardSearch'
import { EmptyBoard, NewNoteButton, SelectionBar, ZoomControls } from '../board/BoardOverlays'
import { useBoardView } from '../board/useBoardView'
import { useNoteSizes } from '../board/useNoteSizes'
import { NOTE_STATUSES } from '../domain/constants'
import { EMPTY_SEARCH, isSearchActive, searchNotes } from '../domain/search'
import { useI18n } from '../i18n'
import { ProjectSwitcher } from '../layout/ProjectSwitcher'
import { Sidebar } from '../layout/Sidebar'
import { StatusBar } from '../layout/StatusBar'
import { TopBar } from '../layout/TopBar'
import { AiContextDialog } from '../panels/AiContextDialog'
import { BulkEditor } from '../panels/BulkEditor'
import { DocumentationEditor } from '../panels/DocumentationEditor'
import { FilesDialog } from '../panels/FilesDialog'
import { HelpDialog } from '../panels/HelpDialog'
import { NoteEditor } from '../panels/NoteEditor'
import { StatusStylesDialog } from '../panels/StatusStylesDialog'
import { WorkspaceEditor } from '../panels/WorkspaceEditor'
import { ProjectRootContext } from '../state/projectRoot'
import { useNoteClipboard } from '../state/useNoteClipboard'
import { ensureReadWrite } from '../storage/recentProjects'
import type { ActiveProject, Projects } from '../state/useProjects'
import { useToast } from '../ui/toasts'
import { createWorkspaceActions } from './workspaceActions'
import { useWorkspaceShortcuts } from './useWorkspaceShortcuts'
import { useWorkspaceUi } from './useWorkspaceUi'

// The structure view and its lenses are the heaviest part of the app: loaded on demand.
const loadStructureView = () => import('../structure/StructureView')
const StructureView = lazy(() =>
  loadStructureView().then((module) => ({ default: module.StructureView })),
)

interface WorkspaceScreenProps {
  project: ActiveProject
  projects: Projects
  theme: AppTheme
  onToggleTheme: () => void
}

export function WorkspaceScreen({ project, projects, theme, onToggleTheme }: WorkspaceScreenProps) {
  const { t } = useI18n()
  const toast = useToast()
  const { workspace } = useSyncExternalStore(project.store.subscribe, project.store.getSnapshot)
  const { canvasRef, view } = useBoardView()
  const { sizes, observe } = useNoteSizes()
  const clipboard = useNoteClipboard()
  const ui = useWorkspaceUi(workspace, project.store)
  const actions = createWorkspaceActions({ project, ui, view, sizes, clipboard, toast, t })

  useWorkspaceShortcuts(actions, ui, projects)

  // Counted once per opening, whether by shortcut or button.
  const searchOpen = ui.search !== null
  useEffect(() => {
    if (searchOpen) track('search-open')
  }, [searchOpen])
  useEffect(() => {
    if (ui.view === 'structure') track('structure-open')
  }, [ui.view])

  // Fetched once the board is up, so the view opens at once and works offline too.
  useEffect(() => {
    const timer = window.setTimeout(() => void loadStructureView(), 2000)

    return () => window.clearTimeout(timer)
  }, [])

  const { side, modal, selectedIds, selectedNotes, editingNote } = ui
  const singleSelected = selectedNotes.length === 1 ? selectedNotes[0] : null

  const structureOpen = ui.view === 'structure'
  const search = structureOpen ? null : ui.search
  const matches = useMemo(
    () => (search ? searchNotes(workspace.notes, search) : []),
    [workspace.notes, search],
  )
  const matchIds = useMemo(
    () => (search && isSearchActive(search) ? new Set(matches.map((note) => note.id)) : null),
    [search, matches],
  )
  const usedStatuses = useMemo(
    () => NOTE_STATUSES.filter((status) => workspace.notes.some((note) => note.status === status)),
    [workspace.notes],
  )

  const closeSearch = () => {
    ui.setSearch(null)
    // Keyboard focus goes to the note that was found, ready to open or move.
    if (singleSelected) {
      document.querySelector<HTMLElement>(`[data-note-id="${singleSelected.id}"]`)?.focus()
    }
  }

  return (
    <ProjectRootContext.Provider value={project.handle}>
      <div className="screen">
        <TopBar
          theme={theme}
          onToggleTheme={onToggleTheme}
          onOpenHelp={() => ui.setModal('help')}
          project={
            <ProjectSwitcher
              current={project}
              tabs={projects.tabs}
              onSwitch={(id) => void projects.switchTo(id)}
              onOpen={() => void projects.openPicker()}
              onClose={(id) => void projects.close(id)}
              recents={projects.recents}
              onOpenRecent={(recent) => {
                track('project-reopen')
                void projects.open(recent.handle)
              }}
            />
          }
          actions={
            <>
              <button
                type="button"
                className="button"
                aria-pressed={Boolean(search)}
                title={`${t('search')} (Ctrl+F)`}
                onClick={() => (search ? closeSearch() : ui.setSearch(EMPTY_SEARCH))}
              >
                {t('search')}
              </button>
              <button
                type="button"
                className="button"
                aria-pressed={structureOpen}
                title={`${t('structure')} (M)`}
                onClick={() => ui.setView(structureOpen ? 'board' : 'structure')}
              >
                {t('structure')}
              </button>
              <button type="button" className="button" onClick={() => ui.setModal('styles')}>
                {t('styles')}
              </button>
              <button type="button" className="button" onClick={() => ui.setModal('files')}>
                {t('files')}
              </button>
            </>
          }
        />

        <div className="workspace" aria-busy={projects.loading}>
          <Sidebar
            workspace={workspace}
            selectedNotes={selectedNotes}
            copiedScope={ui.copiedScope}
            onEditWorkspace={() => ui.setSide({ kind: 'workspace' })}
            onOpenAiContext={() => ui.setModal('ai')}
            onCopyContext={(scope) => void actions.copyContext(scope)}
            onAddDocumentation={() =>
              ui.setSide({
                kind: 'documentation',
                isNew: true,
                documentation: { id: crypto.randomUUID(), name: '', url: '', type: 'web' },
              })
            }
            onEditDocumentation={(documentation) =>
              ui.setSide({ kind: 'documentation', isNew: false, documentation })
            }
            onRemoveDocumentation={actions.removeDocumentation}
            onSelectStatus={actions.selectStatus}
          />

          <main className="board-area" aria-label={t('board')}>
            {/* The board stays mounted under the structure view: its pan, zoom and
                measurements are ready the moment a note is shown from there. */}
            <div className="board-layer" inert={structureOpen}>
              <Board
                workspace={workspace}
                view={view}
                canvasRef={canvasRef}
                sizes={sizes}
                observe={observe}
                selectedIds={selectedIds}
                connectingFrom={ui.connectingFrom}
                selectedConnectionId={ui.selectedConnectionId}
                flash={ui.flash}
                matchIds={matchIds}
                onSelect={ui.select}
                onToggleSelect={ui.toggleSelect}
                onClearSelection={ui.clearSelection}
                onRaise={actions.raise}
                onMove={actions.move}
                onMoveEnd={actions.endMove}
                onMoveBy={actions.moveBy}
                onConnectingChange={ui.setConnectingFrom}
                onConnect={actions.connect}
                onSelectConnection={ui.setSelectedConnectionId}
                onDeleteConnection={actions.deleteConnection}
              />

              {search && (
                <BoardSearch
                  search={search}
                  matches={matches}
                  statuses={usedStatuses}
                  currentId={singleSelected?.id ?? null}
                  onChange={ui.setSearch}
                  onShow={actions.showNote}
                  onClose={closeSearch}
                />
              )}

              {workspace.notes.length === 0 && <EmptyBoard onCreate={actions.createNote} />}

              <ZoomControls
                zoom={view.zoom}
                onZoomIn={view.zoomIn}
                onZoomOut={view.zoomOut}
                onReset={view.reset}
              />

              <NewNoteButton onCreate={actions.createNote} />

              {selectedNotes.length > 1 && (
                <SelectionBar
                  count={selectedNotes.length}
                  onEdit={() => ui.setSide({ kind: 'bulk' })}
                  onCopyContext={() => void actions.copyContext('current')}
                  onDuplicate={() => actions.duplicate(selectedIds)}
                  onDelete={() => actions.deleteNotes(selectedIds)}
                  onClear={ui.clearSelection}
                />
              )}
            </div>

            {structureOpen && (
              <Suspense
                fallback={
                  <section className="structure" aria-busy="true">
                    <p className="structure__message">{t('structureLoading')}</p>
                  </section>
                }
              >
                <StructureView
                  projectName={project.name}
                  notes={workspace.notes}
                  selectedIds={selectedIds}
                  onShowNote={(id) => {
                    ui.setView('board')
                    actions.showNote(id)
                  }}
                  onEditNote={(id) => {
                    ui.setView('board')
                    actions.showNote(id)
                    ui.select([id], { open: true })
                  }}
                  onClose={() => ui.setView('board')}
                />
              </Suspense>
            )}
          </main>

          {side?.kind === 'note' && editingNote && (
            <NoteEditor
              key={editingNote.id}
              note={editingNote}
              focusTitle={side.focusTitle}
              onChange={(patch) => actions.updateNote(editingNote.id, patch)}
              onClose={() => ui.setSide(null)}
              onDelete={() => actions.deleteNotes([editingNote.id])}
              onAddFiles={() => void actions.addFiles(editingNote.id)}
              onOpenFile={(path) => void actions.openFile(path)}
              onAddImages={(images) => void actions.addImages(editingNote.id, images)}
              onOpenStatusStyles={() => ui.setModal('styles')}
            />
          )}

          {side?.kind === 'bulk' && selectedNotes.length > 1 && (
            <BulkEditor
              notes={selectedNotes}
              onChange={(patch) => actions.updateNotes(selectedIds, patch)}
              onDelete={() => actions.deleteNotes(selectedIds)}
              onClose={() => ui.setSide(null)}
            />
          )}

          {side?.kind === 'workspace' && (
            <WorkspaceEditor
              workspace={workspace}
              folderName={project.handle.name}
              onChange={actions.updateWorkspace}
              onClose={() => ui.setSide(null)}
            />
          )}

          {side?.kind === 'documentation' && (
            <DocumentationEditor
              key={side.documentation.id}
              documentation={side.documentation}
              isNew={side.isNew}
              onSave={actions.saveDocumentation}
              onRemove={() => actions.removeDocumentation(side.documentation)}
              onClose={() => ui.setSide(null)}
            />
          )}
        </div>

        <StatusBar
          projectName={project.name}
          status={projects.saveStatus}
          noteCount={workspace.notes.length}
          onRetry={async () => {
            // Save errors usually mean the browser forgot the folder permission.
            if (await ensureReadWrite(project.handle)) await project.sync.saveNow()
          }}
          onOverwrite={() => void project.sync.overwriteDisk()}
        />

        {modal === 'ai' && (
          <AiContextDialog
            workspace={workspace}
            selectedIds={selectedIds}
            copiedScope={ui.copiedScope}
            onCopy={(scope, text) => void actions.copyContext(scope, text)}
            onSaveContext={actions.saveAiContext}
            onClose={() => ui.setModal(null)}
          />
        )}

        {modal === 'files' && (
          <FilesDialog
            projectName={project.name}
            notes={workspace.notes}
            targetNote={singleSelected}
            onOpenFile={(path) => void actions.openFile(path)}
            onLinkFile={(path) => singleSelected && actions.linkFiles(singleSelected.id, [path])}
            onCopyPath={actions.copyPath}
            onClose={() => ui.setModal(null)}
          />
        )}

        {modal === 'styles' && (
          <StatusStylesDialog
            styles={workspace.statusStyles}
            onChange={actions.setStatusStyle}
            onCopyFrom={(source) => void actions.copyStatusStylesFrom(source)}
            onPickSource={() => void actions.pickStatusStylesSource()}
            onClose={() => ui.setModal(null)}
          />
        )}

        {modal === 'help' && <HelpDialog onClose={() => ui.setModal(null)} />}
      </div>
    </ProjectRootContext.Provider>
  )
}
