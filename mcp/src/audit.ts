import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentAction, AgentStamp } from '../../src/types'

/**
 * Every change an agent asks for through MCP, one JSON line each, next to the
 * board. Only ever appended to: it is the record of who did what.
 */
export const LOG_FILE = join('.bruto', 'log.jsonl')

/** Who is calling: the MCP client as it introduced itself, and the agent id it gave, if any. */
export interface Caller {
  client: string
  version?: string
  agent?: string
}

/** What a write tool leaves for the log: the note it changed, once it knows it. */
export interface WriteContext {
  caller: Caller
  note?: string
}

/** The mark a change leaves on the note itself. */
export function stamp(caller: Caller, action: AgentAction): AgentStamp {
  return {
    client: caller.client,
    ...(caller.version && { version: caller.version }),
    ...(caller.agent && { id: caller.agent }),
    action,
    at: new Date().toISOString(),
  }
}

/** The commit the project was on, when it is a git repository. */
function headCommit(root: string): string | undefined {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    })

    return commit.toString().trim() || undefined
  } catch {
    return undefined
  }
}

/** What each file held when the agent answered: ties the answer to the exact code it describes. */
function fingerprints(root: string, files: string[]): Record<string, string | null> {
  return Object.fromEntries(
    files.map((path) => {
      try {
        const hash = createHash('sha256')
          .update(readFileSync(join(root, path)))
          .digest('hex')

        return [path, `sha256:${hash}`]
      } catch {
        // Deleted, or never there: the log says so.
        return [path, null]
      }
    }),
  )
}

export interface LogEntry {
  tool: string
  /** The note's full id, when the call got as far as finding it. */
  note?: string
  args: Record<string, unknown>
  ok: boolean
  /** What the tool answered, or why it refused. */
  result: string
  /** Files the change is about, fingerprinted as they are now. */
  files?: string[]
}

/** Adds one call to the log. A project without a board has nowhere to keep it. */
export function appendLog(root: string, caller: Caller, entry: LogEntry) {
  if (!existsSync(join(root, '.bruto'))) return

  const commit = headCommit(root)
  const line = {
    at: new Date().toISOString(),
    tool: entry.tool,
    client: caller.client,
    ...(caller.version && { version: caller.version }),
    ...(caller.agent && { agent: caller.agent }),
    ...(entry.note && { note: entry.note }),
    args: entry.args,
    ok: entry.ok,
    result: entry.result,
    ...(commit && { commit }),
    ...(entry.files?.length && { files: fingerprints(root, entry.files) }),
  }

  appendFileSync(join(root, LOG_FILE), `${JSON.stringify(line)}\n`)
}
