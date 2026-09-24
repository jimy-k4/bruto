import { useCallback, useEffect, useState } from 'react'
import { parseClipboard, type NoteClipboard } from '../domain/clipboard'

const STORAGE_KEY = 'bruto-clipboard-note'

function readStored(): NoteClipboard | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    return raw ? parseClipboard(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

/**
 * Notes copied with Ctrl+C. Stored locally so they can be pasted into another
 * project, another tab, or after a reload.
 */
export function useNoteClipboard() {
  const [clipboard, setClipboard] = useState<NoteClipboard | null>(readStored)

  // Copies made in another tab become available here too.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setClipboard(readStored())
    }

    window.addEventListener('storage', onStorage)

    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const save = useCallback((next: NoteClipboard) => {
    setClipboard(next)

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Too big or blocked: it still works in this tab.
    }
  }, [])

  return { clipboard, save }
}
