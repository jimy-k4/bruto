import type { Environment, Note } from '../types'
import { findEnvironment, isLive } from '../domain/environments'
import { useI18n } from '../i18n'
import { formatDate } from './format'

interface EnvironmentStampProps {
  /** What the stamp says. */
  name: string
  /** Production: inked solid, the one that matters most. */
  live?: boolean
  /** Where it is along the project's environments, from 1, and how many there are. */
  step?: number
  steps?: number
  title?: string
  className?: string
}

/** A rubber stamp with the environment a note's change has got to: "PRE ■■■□". */
export function EnvironmentStamp({
  name,
  live = false,
  step,
  steps,
  title,
  className,
}: EnvironmentStampProps) {
  return (
    <span
      className={['env-stamp', live && 'env-stamp--live', className].filter(Boolean).join(' ')}
      title={title}
    >
      {name}
      {step && steps && steps > 1 ? (
        <span className="env-stamp__steps" aria-hidden="true">
          {Array.from({ length: steps }, (_, index) => (
            <i key={index} className={index < step ? 'is-reached' : undefined} />
          ))}
        </span>
      ) : null}
    </span>
  )
}

interface NoteEnvironmentProps {
  note: Pick<Note, 'environment' | 'environmentAt'>
  environments: readonly Environment[]
  className?: string
}

/** A note's stamp, as its project names its environments. Nothing when it has none. */
export function NoteEnvironment({ note, environments, className }: NoteEnvironmentProps) {
  const { t, language } = useI18n()

  if (!note.environment) return null

  const found = findEnvironment(environments, note.environment)
  const name = found?.name ?? note.environment
  const title = note.environmentAt
    ? t('environmentSince', {
        environment: name,
        date: formatDate(language, Date.parse(note.environmentAt), true),
      })
    : t('environmentIn', { environment: name })

  return (
    <EnvironmentStamp
      name={name}
      live={found ? isLive(environments, found) : false}
      step={found ? environments.indexOf(found) + 1 : undefined}
      steps={environments.length}
      title={title}
      className={className}
    />
  )
}
