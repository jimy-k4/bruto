/**
 * Remembers opened project folders across reloads. Directory handles can only
 * be stored in IndexedDB; the browser still asks for permission again after a
 * restart, which takes a single click.
 */
export interface RecentProject {
  id: string
  name: string
  handle: FileSystemDirectoryHandle
  openedAt: number
}

const DATABASE = 'bruto'
const STORE = 'recent-projects'
const MAX_RECENT = 12

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1)

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'id' })
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase()

  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(database.transaction(STORE, mode).objectStore(STORE))

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    database.close()
  }
}

export async function listRecentProjects(): Promise<RecentProject[]> {
  try {
    const projects = await withStore<RecentProject[]>('readonly', (store) => store.getAll())

    return projects.sort((a, b) => b.openedAt - a.openedAt)
  } catch {
    // Private windows or blocked storage: simply no recents.
    return []
  }
}

/** Records a project as just opened, reusing its entry if the folder was opened before. */
export async function rememberProject(handle: FileSystemDirectoryHandle): Promise<RecentProject> {
  const projects = await listRecentProjects()
  let existing: RecentProject | undefined

  for (const project of projects) {
    if (await project.handle.isSameEntry(handle).catch(() => false)) {
      existing = project
      break
    }
  }

  const entry: RecentProject = {
    id: existing?.id ?? crypto.randomUUID(),
    name: handle.name,
    handle,
    openedAt: Date.now(),
  }

  try {
    await withStore('readwrite', (store) => store.put(entry))

    for (const stale of projects.filter((item) => item.id !== entry.id).slice(MAX_RECENT - 1)) {
      await withStore('readwrite', (store) => store.delete(stale.id))
    }
  } catch {
    // Not being able to remember a project must never block opening it.
  }

  return entry
}

export async function forgetProject(id: string) {
  try {
    await withStore('readwrite', (store) => store.delete(id))
  } catch {
    // Nothing to forget.
  }
}

/** Makes sure Bruto may read and write the folder, asking the user if needed. */
export const ensureReadWrite = (handle: FileSystemDirectoryHandle) =>
  ensureAccess(handle, 'readwrite')

/** Asks for access to a folder when the browser doesn't grant it already. */
export async function ensureAccess(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite',
): Promise<boolean> {
  const options = { mode } as const

  // Without the permission API (private storage, older engines) access is implicit.
  if (!handle.queryPermission || !handle.requestPermission) {
    return true
  }

  if ((await handle.queryPermission(options)) === 'granted') {
    return true
  }

  return (await handle.requestPermission(options)) === 'granted'
}
