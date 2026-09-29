# bruto-mcp

MCP server for [Bruto](https://jimy-k4.github.io/bruto/) boards. AI agents read the tasks of a project
and answer them through tools, instead of editing `.bruto/workspace.json` by hand.

It runs on your machine and reads and writes the board in your project folder. Nothing goes anywhere
else. Bruto, if it's open, shows each change as soon as it's written.

## Install

It needs Node.js 20 or newer.

**Claude Code**, once for every project (the server finds the board of the folder you work in):

```bash
claude mcp add --scope user bruto -- npx -y bruto-mcp
```

Without `--scope user`, it's added to the current project only. Check it with `claude mcp list`: it
should say `✓ Connected` (the first time takes a few seconds while `npx` downloads it).

Or, to share it with everyone who opens the project (Claude Code in the terminal, the desktop app or
an IDE), a `.mcp.json` file at its root:

```json
{
  "mcpServers": {
    "bruto": { "command": "npx", "args": ["-y", "bruto-mcp"] }
  }
}
```

**Claude Desktop, Cursor, Windsurf and other clients**: add it to the client's MCP settings. Most
clients start servers outside your project, so give it the folder:

```json
{
  "mcpServers": {
    "bruto": {
      "command": "npx",
      "args": ["-y", "bruto-mcp", "--project", "/path/to/your/project"]
    }
  }
}
```

Without `--project` (or `BRUTO_PROJECT`), the server uses the closest folder with a board, going up
from where it was started. Every tool also takes a `project` argument, so one server can work across
several projects.

### On Windows

Clients can't start `npx` directly: run it through `cmd`. Behind a company proxy that inspects HTTPS,
Node also needs the system's certificates to download the package. With Claude Code, in PowerShell,
quote the `--` (Windows PowerShell drops it otherwise, and `claude` reads `-y` as its own option):

```powershell
claude mcp add --scope user bruto -e NODE_OPTIONS=--use-system-ca '--' cmd /c npx -y bruto-mcp
```

In a client's settings or a `.mcp.json`:

```json
{
  "mcpServers": {
    "bruto": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "bruto-mcp"],
      "env": { "NODE_OPTIONS": "--use-system-ca" }
    }
  }
}
```

## Tools

| Tool            | What it does                                                                        |
| --------------- | ----------------------------------------------------------------------------------- |
| `list_notes`    | The notes with their short id and status: the open ones, or the statuses asked for. |
| `search_notes`  | Notes by words in any of their texts, files or links, or by the start of their id.  |
| `get_context`   | The Markdown Bruto copies for an AI, with instructions and standing rules.          |
| `get_note`      | One note in full, with the notes it connects with.                                  |
| `set_status`    | Marks a note "in-progress" when the AI starts on it, so it shows on the board.      |
| `answer_note`   | Writes what the AI did, adds the files it touched and sends the note to review.     |
| `create_note`   | Adds a note, as an idea unless told otherwise, next to the one it follows from.     |
| `connect_notes` | Draws an arrow between two notes.                                                   |

Reading tools are marked read-only, so clients can let them run without asking. None of the tools
deletes anything.

And one prompt, `work_on_notes`: fix what was sent back, then do the `todo` notes one by one.

## Safe with the app and your file

- A broken board is reported, never overwritten.
- Every write goes to a temporary file first and replaces the board in one go.
- Standing rules (notes with status `loop`) are never answered or changed.
- Fields other tools added to the file are kept.

## License

[MIT](LICENSE)
