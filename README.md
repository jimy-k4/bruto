<div align="center">

# BRUTO

**A brutalist task board for projects built with AI.**
Your notes live inside the project folder, where you and any AI can read and answer them.

[**Open Bruto**](https://jimy-k4.github.io/bruto/) · No account · No server · Works offline

<img src="docs/board-dark.png" alt="Bruto board with notes, arrows between them and the note editor open" width="100%" />

</div>

---

## Why

Working on a project with an AI assistant means explaining the same things again and again, in a chat
that forgets. Bruto keeps the tasks of a project as notes in a file inside the project itself,
`.bruto/workspace.json`, so you and every AI you use work from the same source:

1. **You** write tasks on the board: what is wrong, which files, links, screenshots.
2. **You copy** exactly the context the AI needs with one key (`Q`, `W` or `E`).
3. **The AI** answers inside the note and marks it for review, if it can edit files. Bruto picks up
   the change live, without overwriting anything you were typing.

## Install

Nothing to download. Open **[jimy-k4.github.io/bruto](https://jimy-k4.github.io/bruto/)** in Chrome, Edge,
Brave or Opera and press **Install app** in the top bar (or the install icon in the address bar).
Bruto then opens in its own window, from the Start menu or the Dock, and works offline.

Prefer to run it yourself? See [Development](#development).

## Features

- **Board.** Notes with a status, description, files, a link and screenshots. Drag them, connect them
  with arrows, select many at once and edit them together.
- **AI context.** Copy the selection, the selection plus everything it points to, or the whole
  project, as clean Markdown with short instructions for the model. A preview shows exactly what gets
  copied and roughly how many tokens it is.
- **Answers in the note.** Each note has an _AI response_ and a _What's wrong_ field, so review
  loops stay attached to the task.
- **Safe with other tools.** Every save reads the file first and merges changes made elsewhere, note by
  note and field by field. A broken file is never overwritten: Bruto shows what is wrong and offers the
  latest backup (one is kept each time a project is opened).
- **Keyboard first and accessible.** Every action has a shortcut, notes are reachable with Tab, dialogs
  trap focus and everything has a readable name for screen readers.
- **Nine languages**, light and dark themes, installable, works offline.
- **Local only.** The app is a static page: it has no server, no analytics and no storage of its own.
  Your notes never leave your folders.

<p>
  <img src="docs/ai-context-light.png" alt="The AI context window with the global context and a preview of the copy" width="49%" />
  <img src="docs/status-styles-light.png" alt="Status styles: the color and pattern each status gives a note" width="49%" />
</p>

## Working with an AI

Paste the copy into any chat (Claude, ChatGPT, Gemini, DeepSeek…). It starts with instructions like
these, so the model knows how to answer:

```markdown
## HOW TO USE THIS CONTEXT

- Notes are tasks. Refer to a note by its short id, e.g. [a1b2c3].
- With file access: notes live in `.bruto/workspace.json` (keep it valid JSON). Find a note by the
  start of its `id`. When you finish one, write what you did in its `aiResponse` and set `status`
  to "review". Never delete notes or change `x`, `y` or `zIndex`.
- Without file access: answer note by note, starting each answer with its id.
- Status "changes-requested" means the user reviewed your previous answer and wrote what is wrong
  in "Feedback": fix that first, say what you fixed in `aiResponse`, empty `feedback` and set the
  status back to "review".
```

Coding agents that work in your repository can also be pointed at the file directly, for example with
one line in `AGENTS.md` or `CLAUDE.md`:

```markdown
Tasks for this project are in `.bruto/workspace.json`. Work on notes whose status is "todo".
```

## The workspace file

Plain JSON, meant to be read and edited by people and tools alike. Bruto fills in anything missing, keeps
fields it does not know about, and accepts common status words such as `"pending"` or `"completed"`.

```jsonc
{
  "version": 3,
  "title": "ATLAS",
  "description": "What the project is. Heads every copy for the AI.",
  "aiContext": "Stack, decisions, conventions, current state.",
  "documentation": [{ "id": "…", "name": "Design system", "url": "https://…", "type": "web" }],
  "notes": [
    {
      "id": "b72f10aa-…",
      "title": "Cancel a booking",
      "description": "Users can cancel up to 2 hours before the session.",
      "status": "review", // idea · todo · in-progress · review · changes-requested · done · blocked · bug · wontfix
      "filePaths": ["app/bookings/actions.ts"], // relative to the project
      "webUrl": "",
      "images": [".bruto/images/b72f10-20260924-ab12.png"],
      "aiResponse": "Added cancelBooking() with the 2h rule.",
      "feedback": "Still possible after the deadline on mobile.",
      "x": 420,
      "y": 60,
      "zIndex": 2,
      "colorTheme": "plum",
      "pattern": "dots",
    },
  ],
  "connections": [{ "id": "…", "from": "<note id>", "to": "<note id>" }],
  "statusStyles": { "review": { "color": "plum", "pattern": "dots" } },
}
```

Add `.bruto/` to your `.gitignore` if the notes should stay on your machine.

## Shortcuts

| Keys                | Action                                | Keys                | Action                                         |
| ------------------- | ------------------------------------- | ------------------- | ---------------------------------------------- |
| `N`                 | New note                              | `Q` / `W` / `E`     | Copy selection / with connections / everything |
| `A`                 | AI context window                     | `C`                 | Connect the selected note                      |
| `Enter`             | Open the focused note                 | `←↑→↓`              | Move notes (`Shift` for bigger steps)          |
| `Ctrl C` / `Ctrl V` | Copy and paste notes, or a screenshot | `Ctrl D`            | Duplicate                                      |
| `Del`               | Delete (undoable)                     | `Ctrl Z` / `Ctrl Y` | Undo / redo                                    |
| `F`                 | Centre the view                       | `Alt 1…9`           | Switch open project                            |
| `Ctrl F` / `/`      | Search notes (text, path or id)       | `Enter`             | Next result (`Shift` for the previous one)     |

Press `?` in the app for the full list.

## Browser support

Bruto opens folders with the File System Access API, available in Chrome, Edge, Brave and Opera on
desktop. Firefox and Safari can't open local folders yet.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # format, lint, types and unit tests
npm run test:e2e   # browser tests (uses the installed Chrome)
npm run build
```

```text
src/
  domain/     pure logic: workspace format, merge, AI context, clipboard (unit tested)
  storage/    the project folder: workspace file, backups, images, recent projects
  state/      in-memory workspace with undo, and the engine that keeps it in sync with disk
  board/      the canvas: notes, connections, pan, zoom, selection
  panels/     editors and dialogs
  layout/     top bar, sidebar, status bar, landing
  i18n/       one dictionary per language, checked by tests
  styles/     design tokens and styles
e2e/          browser tests against a real (private) file system
```

## License

[MIT](LICENSE)
