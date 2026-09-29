import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { resolve } from 'node:path'
import { z } from 'zod'
import type { NoteStatus } from '../../src/types'
import { NOTE_STATUSES } from '../../src/domain/constants'
import { BoardError, findProject } from './board'
import { answerNote, connectNotes, createNoteTool, getContext, getNote, listNotes } from './tools'

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
const project = z
  .string()
  .optional()
  .describe('Absolute path of the project folder. Defaults to the one the server was started in.')

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
      'Lists the notes (tasks) on the Bruto board of a project with their short id and status. By default the open ones; filter by status, e.g. ["todo"] or ["changes-requested"].',
    inputSchema: {
      project,
      status: z.array(status).optional().describe('Only notes with one of these statuses.'),
      includeClosed: z.boolean().optional().describe('Also list done and won’t-fix notes.'),
    },
  },
  (args) =>
    run(() =>
      listNotes(projectRoot(args.project), {
        statuses: args.status,
        includeClosed: args.includeClosed,
      }),
    ),
)

server.registerTool(
  'get_context',
  {
    title: 'Get context',
    description:
      'The project context for the AI, as Markdown: instructions, documentation, global context, notes with their files, answers and feedback, relationships and standing rules (notes with status "loop", to apply on every task). Without ids, the whole board.',
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
  },
  (args) => run(() => getNote(projectRoot(args.project), args.id)),
)

server.registerTool(
  'answer_note',
  {
    title: 'Answer note',
    description:
      'Writes what you did in a note, adds the files you created or changed, and sets its status ("review" by default) so the user can review it. On a note with status "changes-requested", fix what its feedback says first; the feedback is cleared. Put commands and code in Markdown code blocks (```): the note shows each one with a copy button. Never use it on standing rules (status "loop").',
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
  },
  (args) => run(() => answerNote(projectRoot(args.project), args)),
)

server.registerTool(
  'create_note',
  {
    title: 'Create note',
    description:
      'Adds a note to the board: a task you propose or found while working. It starts as an "idea" unless you give another status, so the user decides what to do with it. Starts a board if the project has none.',
    inputSchema: {
      project,
      title: z.string().min(1),
      description: z.string().optional(),
      status: status.optional().describe('Defaults to "idea".'),
      files: z.array(z.string()).optional().describe('Files it is about, relative to the project.'),
      links: z.array(z.string()).optional().describe('Web links: docs, an issue, a design.'),
      after: z
        .string()
        .optional()
        .describe(
          'Short id of a note this one follows from: it is placed next to it and connected.',
        ),
    },
  },
  (args) => run(() => createNoteTool(projectRoot(args.project, { mayCreate: true }), args)),
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
            '4. After each one, call answer_note with what you did and the files you touched.',
            'Apply every standing rule (status "loop") on each task, and never answer them.',
          ].join('\n'),
        },
      },
    ],
  }),
)

await server.connect(new StdioServerTransport())
