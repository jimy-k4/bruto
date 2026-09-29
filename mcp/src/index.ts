import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { resolve } from 'node:path'
import { z } from 'zod'
import type { NoteStatus } from '../../src/types'
import { NOTE_STATUSES } from '../../src/domain/constants'
import type { KindFilter } from '../../src/domain/search'
import { BoardError, findProject } from './board'
import {
  answerNote,
  connectNotes,
  createNoteTool,
  getContext,
  getNote,
  listNotes,
  searchNotes,
  setStatus,
} from './tools'

declare const __VERSION__: string

/**
 * Bruto as an MCP server: the notes of a project, read and answered through
 * tools instead of by editing `.bruto/workspace.json` by hand. Runs locally
 * over stdio; the board never leaves the machine.
 *
 * The project is the `project` argument of each tool, else `--project <folder>`
 * or BRUTO_PROJECT, else the closest folder with a board above the working directory.
 */
const flag = process.argv.indexOf('--project')
const defaultProject = flag !== -1 ? process.argv[flag + 1] : process.env.BRUTO_PROJECT

function projectRoot(given?: string, { mayCreate = false } = {}): string {
  const start = given ?? defaultProject ?? process.cwd()
  const found = findProject(start)

  if (found) return found
  // Creating the first note starts a board in the folder asked for.
  if (mayCreate) return resolve(start)

  throw new BoardError(
    `No Bruto board found in ${resolve(start)} or above. Pass "project" with the project folder, or open it in Bruto first.`,
  )
}

const status = z.enum(NOTE_STATUSES as [NoteStatus, ...NoteStatus[]])
const kind = z.enum(['task', 'bug', 'rule'])
/** Filters by status also take "bug" and "loop", which were statuses until v4: they mean kinds now. */
const statusFilter = z
  .array(z.union([status, z.enum(['bug', 'loop'])]))
  .optional()
  .describe('Only notes with one of these statuses.')
const kindFilter = z
  .array(kind)
  .optional()
  .describe('Only notes of one of these kinds: "task", "bug" or "rule" (standing rules).')

/** Splits a status filter into statuses and the kinds its old words stand for. */
function filters(args: { status?: string[]; kind?: KindFilter[] }) {
  const statuses = (args.status ?? []).filter((item): item is NoteStatus =>
    (NOTE_STATUSES as readonly string[]).includes(item),
  )
  const kinds = [
    ...(args.kind ?? []),
    ...(args.status ?? []).flatMap((item): KindFilter[] =>
      item === 'bug' ? ['bug'] : item === 'loop' ? ['rule'] : [],
    ),
  ]

  return { statuses, kinds }
}
const project = z
  .string()
  .optional()
  .describe('Absolute path of the project folder. Defaults to the one the server was started in.')

/** Tools that only read: clients may run them without asking. */
const READS = { readOnlyHint: true, openWorldHint: false } as const
/** Tools that write to the board, but never delete anything from it. */
const WRITES = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const

/** Runs a tool and turns a board problem into a message the model can act on. */
function run(action: () => string) {
  try {
    return { content: [{ type: 'text' as const, text: action() }] }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    return { content: [{ type: 'text' as const, text: message }], isError: true }
  }
}

const server = new McpServer({ name: 'bruto', version: __VERSION__ })

server.registerTool(
  'list_notes',
  {
    title: 'List notes',
    description:
      'Lists the notes on the Bruto board of a project with their short id, status and kind (bug, rule; none for a task). By default the open ones; filter by status, e.g. ["todo"] or ["changes-requested"], or by kind, e.g. ["bug"].',
    inputSchema: {
      project,
      status: statusFilter,
      kind: kindFilter,
      includeClosed: z.boolean().optional().describe('Also list done and won’t-fix notes.'),
    },
    annotations: READS,
  },
  (args) =>
    run(() =>
      listNotes(projectRoot(args.project), {
        ...filters(args),
        includeClosed: args.includeClosed,
      }),
    ),
)

server.registerTool(
  'get_context',
  {
    title: 'Get context',
    description:
      'The project context for the AI, as Markdown: instructions, documentation, global context, notes with their files, answers and feedback, relationships and standing rules (notes of kind "rule", to apply on every task). Without ids, the whole board.',
    inputSchema: {
      project,
      ids: z
        .array(z.string())
        .optional()
        .describe('Short ids of the notes to include, e.g. ["a1b2c3"].'),
      withConnections: z
        .boolean()
        .optional()
        .describe('Also include every note the given ones point to.'),
    },
    annotations: READS,
  },
  (args) => run(() => getContext(projectRoot(args.project), args)),
)

server.registerTool(
  'get_note',
  {
    title: 'Get note',
    description:
      'One note in full: status, description, files, links, images, AI response, feedback and the notes it connects with.',
    inputSchema: { project, id: z.string().describe('Short id, e.g. "a1b2c3".') },
    annotations: READS,
  },
  (args) => run(() => getNote(projectRoot(args.project), args.id)),
)

server.registerTool(
  'answer_note',
  {
    title: 'Answer note',
    description:
      'Writes what you did in a note, adds the files you created or changed, and sets its status ("review" by default) so the user can review it. On a note with status "changes-requested", fix what its feedback says first; the feedback is cleared. Put commands and code in Markdown code blocks (```): the note shows each one with a copy button. Never use it on standing rules (kind "rule").',
    inputSchema: {
      project,
      id: z.string().describe('Short id of the note.'),
      response: z.string().min(1).describe('What you did, for the user to review.'),
      files: z
        .array(z.string())
        .optional()
        .describe('Files you created or changed, relative to the project.'),
      status: status.optional().describe('Defaults to "review".'),
      append: z
        .boolean()
        .optional()
        .describe('Add to the previous answer instead of replacing it.'),
    },
    annotations: WRITES,
  },
  (args) => run(() => answerNote(projectRoot(args.project), args)),
)

server.registerTool(
  'create_note',
  {
    title: 'Create note',
    description:
      'Adds a note to the board: a task or a bug you propose or found while working. It starts as an "idea" unless you give another status, so the user decides what to do with it. Starts a board if the project has none.',
    inputSchema: {
      project,
      title: z.string().min(1),
      description: z.string().optional(),
      status: status.optional().describe('Defaults to "idea".'),
      kind: z
        .enum(['task', 'bug'])
        .optional()
        .describe(
          '"bug" for something broken; a task by default. Standing rules are the user’s to write.',
        ),
      files: z.array(z.string()).optional().describe('Files it is about, relative to the project.'),
      links: z.array(z.string()).optional().describe('Web links: docs, an issue, a design.'),
      after: z
        .string()
        .optional()
        .describe(
          'Short id of a note this one follows from: it is placed next to it and connected.',
        ),
    },
    annotations: WRITES,
  },
  (args) => run(() => createNoteTool(projectRoot(args.project, { mayCreate: true }), args)),
)

server.registerTool(
  'search_notes',
  {
    title: 'Search notes',
    description:
      'Finds notes by words in their title, text, files, links, answer or feedback, or by the start of their id; optionally only in some statuses or kinds.',
    inputSchema: {
      project,
      query: z.string().optional().describe('Every word must appear, e.g. "login redirect".'),
      status: statusFilter,
      kind: kindFilter,
    },
    annotations: READS,
  },
  (args) =>
    run(() => searchNotes(projectRoot(args.project), { query: args.query, ...filters(args) })),
)

server.registerTool(
  'set_status',
  {
    title: 'Set status',
    description:
      'Changes where a note stands without answering it. Set "in-progress" when you start on a note, so the user sees on the board what you are working on; use answer_note when you finish. Standing rules (kind "rule") keep their status.',
    inputSchema: {
      project,
      id: z.string().describe('Short id of the note.'),
      status: status.describe('Usually "in-progress" or "blocked".'),
    },
    annotations: { ...WRITES, idempotentHint: true },
  },
  (args) => run(() => setStatus(projectRoot(args.project), args)),
)

server.registerTool(
  'connect_notes',
  {
    title: 'Connect notes',
    description: 'Draws an arrow from one note to another: "this one leads to that one".',
    inputSchema: {
      project,
      from: z.string().describe('Short id of the note the arrow starts at.'),
      to: z.string().describe('Short id of the note it points to.'),
    },
    annotations: { ...WRITES, idempotentHint: true },
  },
  (args) => run(() => connectNotes(projectRoot(args.project), args)),
)

server.registerPrompt(
  'work_on_notes',
  {
    title: 'Work on the notes',
    description: 'Work through the board: fix what was sent back, then do the tasks.',
    argsSchema: { status: z.string().optional().describe('Which notes, "todo" by default.') },
  },
  ({ status }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            'Work on this project’s Bruto board.',
            '1. Call get_context to read the project, its rules and its notes.',
            '2. First the notes with status "changes-requested": fix what their feedback says.',
            `3. Then the notes with status "${status || 'todo'}", one by one.`,
            '4. Before starting a note, call set_status with "in-progress": the user sees it on the board.',
            '5. After each one, call answer_note with what you did and the files you touched.',
            'Apply every standing rule (kind "rule") on each task, and never answer them.',
          ].join('\n'),
        },
      },
    ],
  }),
)

await server.connect(new StdioServerTransport())
