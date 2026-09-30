import { readSources, type IndexedFile } from '../storage/projectFiles'
import type { DetectedLens } from './detect'
import type { LensJob, LensReply } from './lensWorker'
import { readerFor, type LensModel } from './readers'

export type { LensModel } from './readers'

export interface LoadOptions {
  /** How many of the files the lens wants are read, after each batch. */
  onProgress?: (read: number, total: number) => void
  /** Stops the parsing: another project or lens took over. */
  signal?: AbortSignal
}

/** Reads only the code a lens needs, then parses it with the reader for its stack, off the page. */
export async function loadLens(
  lens: DetectedLens,
  files: IndexedFile[],
  paths: string[],
  { onProgress, signal }: LoadOptions = {},
): Promise<LensModel> {
  const sources = await readSources(files, readerFor(lens).wanted, onProgress)

  signal?.throwIfAborted()

  return parseInWorker({ lens, paths, sources }, signal)
}

/** Parses in a worker; in the page when there is none, or it can't start (an old tab after a deploy). */
function parseInWorker(job: LensJob, signal?: AbortSignal): Promise<LensModel> {
  const parseHere = () => readerFor(job.lens).build(job.sources, job.paths)

  if (typeof Worker === 'undefined') return Promise.resolve(parseHere())

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./lensWorker.ts', import.meta.url), { type: 'module' })
    const stop = () => {
      worker.terminate()
      signal?.removeEventListener('abort', abort)
    }
    const abort = () => {
      stop()
      reject(signal?.reason)
    }

    signal?.addEventListener('abort', abort, { once: true })

    worker.onmessage = ({ data }: MessageEvent<LensReply>) => {
      stop()
      if ('model' in data) resolve(data.model)
      else reject(new Error(data.error))
    }
    worker.onerror = (event) => {
      event.preventDefault()
      stop()
      try {
        resolve(parseHere())
      } catch (error) {
        reject(error)
      }
    }

    worker.postMessage(job)
  })
}

/** What a lens draws when its code can't be read. */
export function emptyModel(lens: DetectedLens): LensModel {
  if (lens.kind === 'web') return { framework: lens.framework ?? 'react', elements: [] }
  if (lens.kind === 'api') return { resources: [], parts: [] }

  return { tables: [], relations: [], programs: [] }
}
