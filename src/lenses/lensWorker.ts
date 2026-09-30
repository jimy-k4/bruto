/**
 * Parses a lens's code away from the page: thousands of SQL scripts take
 * seconds, and the window has to keep answering meanwhile.
 */
import type { SourceFile } from '../storage/projectFiles'
import type { DetectedLens } from './detect'
import { readerFor, type LensModel } from './readers'

export interface LensJob {
  lens: DetectedLens
  paths: string[]
  sources: SourceFile[]
}

export type LensReply = { model: LensModel } | { error: string }

self.addEventListener('message', (event: MessageEvent<LensJob>) => {
  const { lens, paths, sources } = event.data
  let reply: LensReply

  try {
    reply = { model: readerFor(lens).build(sources, paths) }
  } catch (error) {
    reply = { error: error instanceof Error ? error.message : String(error) }
  }

  self.postMessage(reply)
})
