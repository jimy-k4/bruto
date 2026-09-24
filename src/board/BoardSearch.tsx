import type { Note, NoteStatus } from '../types'
import {
  NOTE_TRAITS,
  isSearchActive,
  nextTraitFilter,
  type NoteSearch,
  type NoteTrait,
} from '../domain/search'
import { statusLabel, useI18n, type TranslationKey } from '../i18n'

interface BoardSearchProps {
  search: NoteSearch
  matches: Note[]
  /** Statuses that some note has: the only ones worth offering as filters. */
  statuses: NoteStatus[]
  /** The selected note, when there's exactly one. */
  currentId: string | null
  onChange: (search: NoteSearch) => void
  onShow: (id: string) => void
  onClose: () => void
}

const stop = (event: React.PointerEvent) => event.stopPropagation()

/** What a trait button says when it lets any note through, only notes with it, or only without. */
const TRAIT_LABELS: Record<NoteTrait, [TranslationKey, TranslationKey, TranslationKey]> = {
  files: ['filterFiles', 'filterWithFiles', 'filterWithoutFiles'],
  aiResponse: ['filterAiResponse', 'filterWithAiResponse', 'filterWithoutAiResponse'],
  images: ['filterImages', 'filterWithImages', 'filterWithoutImages'],
  webUrl: ['filterWeb', 'filterWithWeb', 'filterWithoutWeb'],
}

/** Search bar over the board: matches stand out, Enter walks through them. */
export function BoardSearch({
  search,
  matches,
  statuses,
  currentId,
  onChange,
  onShow,
  onClose,
}: BoardSearchProps) {
  const { t } = useI18n()
  const index = matches.findIndex((note) => note.id === currentId)
  const total = matches.length
  const active = isSearchActive(search)

  const step = (direction: 1 | -1) => {
    if (total === 0) return

    const next =
      index === -1 ? (direction === 1 ? 0 : total - 1) : (index + direction + total) % total

    onShow(matches[next].id)
  }

  const toggleStatus = (status: NoteStatus) =>
    onChange({
      ...search,
      statuses: search.statuses.includes(status)
        ? search.statuses.filter((item) => item !== status)
        : [...search.statuses, status],
    })

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      step(event.shiftKey ? -1 : 1)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    } else if (event.key.toLowerCase() === 'f' && (event.ctrlKey || event.metaKey)) {
      // Ctrl+F again selects the query instead of opening the browser's search.
      event.preventDefault()
      event.currentTarget.select()
    }
  }

  return (
    <div className="board-search" role="search" aria-label={t('search')} onPointerDown={stop}>
      <div className="board-search__row">
        <label className="visually-hidden" htmlFor="board-search-input">
          {t('search')}
        </label>
        <input
          id="board-search-input"
          className="board-search__input"
          type="search"
          value={search.query}
          placeholder={t('searchPlaceholder')}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange({ ...search, query: event.target.value })}
          onKeyDown={onKeyDown}
        />

        <output className="board-search__count" aria-live="polite">
          {!active ? null : total === 0 ? (
            t('searchNoResults')
          ) : (
            <>
              <span aria-hidden="true">
                {index === -1 ? '–' : index + 1}/{total}
              </span>
              <span className="visually-hidden">
                {t('searchMatch', { current: index === -1 ? '–' : index + 1, count: total })}
              </span>
            </>
          )}
        </output>

        <button
          type="button"
          className="board-search__button"
          onClick={() => step(-1)}
          disabled={total === 0}
          aria-label={t('previousMatch')}
          title={`${t('previousMatch')} (Shift+Enter)`}
        >
          ↑
        </button>
        <button
          type="button"
          className="board-search__button"
          onClick={() => step(1)}
          disabled={total === 0}
          aria-label={t('nextMatch')}
          title={`${t('nextMatch')} (Enter)`}
        >
          ↓
        </button>
        <button
          type="button"
          className="board-search__button"
          onClick={onClose}
          aria-label={t('closeSearch')}
          title={`${t('closeSearch')} (Esc)`}
        >
          ×
        </button>
      </div>

      <div className="board-search__traits" role="group" aria-label={t('filterByContent')}>
        {NOTE_TRAITS.map((trait) => {
          const wanted = search.traits?.[trait]
          const [any, withIt, withoutIt] = TRAIT_LABELS[trait]

          return (
            <button
              key={trait}
              type="button"
              className="board-search__trait"
              data-wanted={wanted === undefined ? undefined : String(wanted)}
              aria-pressed={wanted !== undefined}
              title={t('filterCycleHint')}
              onClick={() =>
                onChange({
                  ...search,
                  traits: { ...search.traits, [trait]: nextTraitFilter(wanted) },
                })
              }
            >
              {t(wanted === undefined ? any : wanted ? withIt : withoutIt)}
            </button>
          )
        })}
      </div>

      {statuses.length > 1 && (
        <div className="board-search__statuses" role="group" aria-label={t('filterByStatus')}>
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              className={`status-badge status-badge--${status} board-search__status`}
              aria-pressed={search.statuses.includes(status)}
              onClick={() => toggleStatus(status)}
            >
              {statusLabel(t, status)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
