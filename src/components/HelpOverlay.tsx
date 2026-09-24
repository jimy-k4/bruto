import { SHORTCUT_DEFINITIONS } from '../lib/shortcuts'
import type { Translator } from '../i18n/translations'

interface HelpOverlayProps {
  t: Translator
  helpSearch: string
  onHelpSearchChange: (value: string) => void
  onClose: () => void
}

export function HelpOverlay({ t, helpSearch, onHelpSearchChange, onClose }: HelpOverlayProps) {
  const normalizedHelpSearch = helpSearch.trim().toLowerCase()

  const filteredShortcuts = SHORTCUT_DEFINITIONS.filter((shortcut) => {
    if (!normalizedHelpSearch) {
      return true
    }

    return [shortcut.keys, t(shortcut.title), t(shortcut.description)]
      .join(' ')
      .toLowerCase()
      .includes(normalizedHelpSearch)
  })

  return (
    <div
      className="ai-context-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <section className="ai-context-window shortcuts-window">
        <header className="ai-context-window-header">
          <div>
            <p className="sidebar-label">{t('help')}</p>

            <h2>{t('shortcutsTitle')}</h2>

            <p>{t('shortcutsDescription')}</p>
          </div>

          <button className="note-editor-close" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="shortcuts-search-wrap">
          <input
            type="search"
            value={helpSearch}
            onChange={(event) => onHelpSearchChange(event.target.value)}
            placeholder={t('shortcutsSearch')}
            autoFocus
            className="shortcuts-search"
          />
        </div>

        <div className="shortcuts-list">
          {filteredShortcuts.length > 0 ? (
            filteredShortcuts.map((shortcut) => (
              <div key={`${shortcut.keys}-${shortcut.title}`} className="shortcut-row">
                <div className="shortcut-keys">
                  <kbd>{shortcut.keys}</kbd>
                </div>

                <div className="shortcut-description">
                  <strong>{t(shortcut.title)}</strong>

                  <span>{t(shortcut.description)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="shortcuts-empty">{t('shortcutsNoResults')}</div>
          )}
        </div>

        <footer className="ai-context-window-footer">
          <button className="secondary-button" onClick={onClose}>
            {t('close')}
          </button>
        </footer>
      </section>
    </div>
  )
}
