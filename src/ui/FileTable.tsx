import { useI18n } from '../i18n'
import { formatDate, formatFileSize, shortenPath } from './format'
import { useFileInfo } from './projectFileHooks'

interface FileTableProps {
  paths: string[]
  /** Rows shown before collapsing the rest into "+N". */
  limit?: number
  compact?: boolean
  onOpen?: (path: string) => void
  onRemove?: (path: string) => void
}

/** Linked files with their real size and last change, read from the project. */
export function FileTable({ paths, limit, compact = false, onOpen, onRemove }: FileTableProps) {
  const { t } = useI18n()
  const visible = limit ? paths.slice(0, limit) : paths
  const hidden = paths.length - visible.length

  return (
    <table className={`file-table ${compact ? 'file-table--compact' : ''}`}>
      <thead>
        <tr>
          <th scope="col">{t('file')}</th>
          <th scope="col">{t('size')}</th>
          <th scope="col">{t('modified')}</th>
          {onRemove && (
            <th scope="col">
              <span className="visually-hidden">{t('actions')}</span>
            </th>
          )}
        </tr>
      </thead>

      <tbody>
        {visible.map((path) => (
          <FileRow key={path} path={path} compact={compact} onOpen={onOpen} onRemove={onRemove} />
        ))}
      </tbody>

      {hidden > 0 && (
        <tfoot>
          <tr>
            <td colSpan={onRemove ? 4 : 3}>+{hidden}</td>
          </tr>
        </tfoot>
      )}
    </table>
  )
}

function FileRow({
  path,
  compact,
  onOpen,
  onRemove,
}: {
  path: string
  compact: boolean
  onOpen?: (path: string) => void
  onRemove?: (path: string) => void
}) {
  const { t, language } = useI18n()
  const info = useFileInfo(path)
  const label = compact ? shortenPath(path) : path

  return (
    <tr className={info === 'missing' ? 'file-table__row--missing' : undefined}>
      <td title={path}>
        {onOpen ? (
          <button type="button" className="link-button" onClick={() => onOpen(path)}>
            {label}
          </button>
        ) : (
          label
        )}
      </td>

      <td>
        {info === null
          ? '…'
          : info === 'missing'
            ? compact
              ? '—'
              : t('missingFile')
            : formatFileSize(info.size)}
      </td>

      <td>{info && info !== 'missing' ? formatDate(language, info.lastModified) : '—'}</td>

      {onRemove && (
        <td>
          <button
            type="button"
            className="icon-button icon-button--small"
            onClick={() => onRemove(path)}
            aria-label={t('removeItem', { name: path })}
          >
            ×
          </button>
        </td>
      )}
    </tr>
  )
}
