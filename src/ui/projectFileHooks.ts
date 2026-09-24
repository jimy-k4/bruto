import { useEffect, useState } from 'react'
import { getFileHandle, getFileInfo } from '../storage/projectFiles'
import { useProjectRoot } from '../state/projectRoot'

export interface FileInfo {
  size: number
  lastModified: number
}

/** Size and date of a project file; null while loading or if it doesn't exist. */
export function useFileInfo(path: string): FileInfo | null | 'missing' {
  const root = useProjectRoot()
  const [info, setInfo] = useState<{ path: string; value: FileInfo | 'missing' } | null>(null)

  useEffect(() => {
    let cancelled = false

    getFileInfo(root, path)
      .then((file) => !cancelled && setInfo({ path, value: file }))
      .catch(() => !cancelled && setInfo({ path, value: 'missing' }))

    return () => {
      cancelled = true
    }
  }, [root, path])

  return info?.path === path ? info.value : null
}

/** Object URL for an image stored in the project, released automatically. */
export function useProjectImageUrl(path: string): string | null {
  const root = useProjectRoot()
  const [url, setUrl] = useState<{ path: string; value: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    getFileHandle(root, path)
      .then((handle) => handle.getFile())
      .then((file) => {
        if (cancelled) return

        objectUrl = URL.createObjectURL(file)
        setUrl({ path, value: objectUrl })
      })
      .catch(() => undefined)

    return () => {
      cancelled = true

      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [root, path])

  return url?.path === path ? url.value : null
}
