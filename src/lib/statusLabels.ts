import type {
  Note,
  NoteColorTheme,
  NotePattern,
  NoteStatus,
  StatusStyleConfig,
  Workspace,
} from '../types'
import type {
  Translator,
} from '../i18n/translations'

export const noteStatuses: NoteStatus[] =
  [
    'idea',
    'todo',
    'in-progress',
    'blocked',
    'review',
    'done',
    'bug',
    'issue',
    'wontfix',
  ]

/** How a note looks: its own
 * color/pattern, overridden per
 * field by the workspace's status
 * style configuration when one
 * exists for the note's status. */
export function getNoteStyle(
  note: Pick<Note, 'colorTheme' | 'pattern' | 'status'>,
  workspace?: Pick<
    Workspace,
    'statusStyles'
  > | null,
): {
  color: NoteColorTheme
  pattern: NotePattern
} {
  const config: StatusStyleConfig | undefined =
    note.status
      ? workspace?.statusStyles?.[note.status]
      : undefined

  return {
    color:
      config?.color ?? note.colorTheme,
    pattern:
      config?.pattern ?? note.pattern,
  }
}

export function getNoteStatusLabel(
  status: NoteStatus,
  t: Translator,
) {
  switch (status) {
    case 'idea':
      return t('statusIdea')
    case 'todo':
      return t('statusTodo')
    case 'in-progress':
      return t(
        'statusInProgress',
      )
    case 'blocked':
      return t('statusBlocked')
    case 'review':
      return t('statusReview')
    case 'done':
      return t('statusDone')
    case 'bug':
      return t('statusBug')
    case 'issue':
      return t('statusIssue')
    case 'wontfix':
      return t('statusWontfix')
    default:
      return status
  }
}
