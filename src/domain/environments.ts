import type { Environment, Note, Workspace } from '../types'

/** Where most projects run: the developer's machine, development, pre-production and production. */
export const DEFAULT_ENVIRONMENTS: readonly Environment[] = [
  { id: 'local', name: 'LOCAL' },
  { id: 'dev', name: 'DEV' },
  { id: 'pre', name: 'PRE', protected: true },
  { id: 'pro', name: 'PRO', protected: true },
]

/** The project's environments, in order, production last. */
export const projectEnvironments = (workspace: Pick<Workspace, 'environments'>) =>
  workspace.environments ?? DEFAULT_ENVIRONMENTS

const plain = (text: string) => text.trim().toLowerCase()

/**
 * The environment a note or an agent names: by id, or by name as the stamp
 * shows it ("PRE", "pre"). A hand-edited file or a model may write either.
 */
export function findEnvironment(
  environments: readonly Environment[],
  value: string | undefined,
): Environment | undefined {
  if (!value?.trim()) return undefined

  return (
    environments.find((item) => item.id === value) ??
    environments.find(
      (item) => plain(item.id) === plain(value) || plain(item.name) === plain(value),
    )
  )
}

/** Production: the last environment of the list. */
export const isLive = (environments: readonly Environment[], environment: Environment) =>
  environments.at(-1)?.id === environment.id

/** The environment after the note's, where it goes next; none once in production. */
export function nextEnvironment(
  environments: readonly Environment[],
  note: Pick<Note, 'environment'>,
): Environment | undefined {
  const current = findEnvironment(environments, note.environment)

  return current ? environments[environments.indexOf(current) + 1] : environments[0]
}

/** An id for a new environment, from its name, that no other one has. */
export function environmentId(name: string, environments: readonly Environment[]): string {
  const base =
    name
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'env'
  const taken = new Set(environments.map((item) => item.id))
  let id = base

  for (let count = 2; taken.has(id); count++) id = `${base}-${count}`

  return id
}

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * The environments a file lists, valid and without repeats. Not a list: the
 * defaults (undefined). A list, even an empty one, is the project's own.
 */
export function normalizeEnvironments(value: unknown): Environment[] | undefined {
  if (!Array.isArray(value)) return undefined

  const environments: Environment[] = []

  for (const raw of value) {
    // A plain name ("QA") is enough to add one by hand.
    const item = typeof raw === 'string' ? { name: raw } : isRecord(raw) ? raw : null
    const name = typeof item?.name === 'string' ? item.name.trim() : ''

    if (!item || !name) continue

    const given = typeof item.id === 'string' ? item.id.trim() : ''
    const id =
      given && !environments.some((other) => other.id === given)
        ? given
        : environmentId(name, environments)

    // Unknown fields are kept, as on notes: other tools never lose data through Bruto.
    const environment = { ...item, id, name } as Environment

    if (item.protected === true) environment.protected = true
    else delete environment.protected

    environments.push(environment)
  }

  return environments
}
