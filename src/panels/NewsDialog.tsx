import { useI18n } from '../i18n'
import type { NewsEntry } from '../news/news'
import { Dialog } from '../ui/Dialog'
import { RichText } from '../ui/RichText'

const formatDay = (language: string, day: string) =>
  new Intl.DateTimeFormat(language, { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${day}T00:00:00Z`),
  )

/** The noticeboard: what has arrived in Bruto, newest first, with what was unread marked. */
export function NewsDialog({
  entries,
  unread,
  onClose,
}: {
  entries: NewsEntry[]
  /** Ids that were unread when the board opened. */
  unread: Set<string>
  onClose: () => void
}) {
  const { t, language } = useI18n()

  return (
    <Dialog
      eyebrow={t('news')}
      title={t('newsTitle')}
      description={t('newsDescription')}
      onClose={onClose}
    >
      <ol className="news-list">
        {entries.map((entry) => {
          const text = entry.text[language]

          return (
            <li key={entry.id} className={`news-item ${unread.has(entry.id) ? 'is-unread' : ''}`}>
              <p className="news-item__meta">
                <time dateTime={entry.date}>{formatDay(language, entry.date)}</time>
                {unread.has(entry.id) && <span className="news-item__new">{t('newsNew')}</span>}
              </p>
              <h3 className="news-item__title">{text.title}</h3>
              <RichText className="news-item__body" text={text.body} />
            </li>
          )
        })}
      </ol>
    </Dialog>
  )
}
