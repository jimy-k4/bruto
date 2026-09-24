import { useState } from 'react'
import { useI18n } from '../i18n'
import { SHORTCUTS, type KeyLabel } from '../shortcuts/keymap'
import { Dialog } from '../ui/Dialog'

export function HelpDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const keyText = (key: KeyLabel) => (typeof key === 'string' ? key : t(key.label))
  const needle = query.trim().toLowerCase()

  const shortcuts = SHORTCUTS.filter(
    (shortcut) =>
      !needle ||
      [...shortcut.keys.map(keyText), t(shortcut.title), t(shortcut.description)]
        .join(' ')
        .toLowerCase()
        .includes(needle),
  )

  return (
    <Dialog
      eyebrow={t('help')}
      title={t('shortcutsTitle')}
      description={t('shortcutsDescription')}
      onClose={onClose}
    >
      <label className="visually-hidden" htmlFor="shortcut-search">
        {t('searchShortcuts')}
      </label>
      <input
        id="shortcut-search"
        type="search"
        className="input"
        placeholder={t('searchShortcuts')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        data-autofocus
      />

      {shortcuts.length === 0 ? (
        <p className="empty-text">{t('noShortcutsFound')}</p>
      ) : (
        <dl className="shortcut-list">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.title} className="shortcut-list__row">
              <dt className="shortcut-list__keys">
                {shortcut.keys.map((key, index) => (
                  <kbd key={index}>{keyText(key)}</kbd>
                ))}
              </dt>
              <dd>
                <strong>{t(shortcut.title)}</strong>
                <span>{t(shortcut.description)}</span>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Dialog>
  )
}
