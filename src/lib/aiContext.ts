import type {
  Connection,
  ContextScope,
  Note,
  Workspace,
} from '../types'

export function getNoteDisplayTitle(
  note: Note,
) {
  return (
    note.title.trim() ||
    'Untitled'
  )
}

export function getDocumentationTypeLabel(
  type:
    | 'obsidian'
    | 'notion'
    | 'web'
    | 'other',
) {
  switch (type) {
    case 'obsidian':
      return 'OBSIDIAN'

    case 'notion':
      return 'NOTION'

    case 'web':
      return 'WEB'

    default:
      return 'OTHER'
  }
}

export function getConnectedNoteIds(
  workspace: Workspace,
  startNoteId: string,
) {
  const visited =
    new Set<string>()

  const queue = [
    startNoteId,
  ]

  visited.add(startNoteId)

  while (queue.length > 0) {
    const currentId =
      queue.shift()

    if (!currentId) {
      continue
    }

    const outgoingConnections =
      workspace.connections.filter(
        (connection) =>
          connection.from ===
          currentId,
      )

    for (const connection of outgoingConnections) {
      if (
        visited.has(
          connection.to,
        )
      ) {
        continue
      }

      visited.add(
        connection.to,
      )

      queue.push(
        connection.to,
      )
    }
  }

  return visited
}

export function areConnectionsBidirectional(
  connections: Connection[],
  first: Connection,
) {
  return connections.some(
    (connection) =>
      connection.from ===
        first.to &&
      connection.to ===
        first.from,
  )
}

export function getUniqueRelationshipConnections(
  connections: Connection[],
) {
  const relationships =
    new Map<
      string,
      Connection
    >()

  for (const connection of connections) {
    const ids = [
      connection.from,
      connection.to,
    ].sort()

    const key =
      ids.join('::')

    if (
      !relationships.has(
        key,
      )
    ) {
      relationships.set(
        key,
        connection,
      )
    }
  }

  return Array.from(
    relationships.values(),
  )
}

/**
 * Builds the markdown context
 * string copied into AI chats.
 *
 * Deliberately lean: no per-note
 * UUIDs (a model can't use a
 * random id; titles identify
 * notes), no "CONTEXT SCOPE"
 * header for single-note copies
 * (the note itself already says
 * what it is), no empty
 * relationships section, no
 * signature footer, single blank
 * lines between blocks.
 *
 * `selectedNoteIds` holds every
 * root note of the copy: one id
 * for the normal single selection
 * or several ids when the user
 * multi-selected notes on the
 * board.
 */
export function buildAiContext(
  workspace: Workspace,
  scope: ContextScope,
  selectedNoteIds: string[],
) {
  let includedNoteIds = new Set<string>()

  if (scope === 'entire') {
    includedNoteIds = new Set(
      workspace.notes.map(
        (note) => note.id,
      ),
    )
  }

  if (
    scope !== 'entire' &&
    selectedNoteIds.length > 0
  ) {
    if (scope === 'current') {
      for (const noteId of selectedNoteIds) {
        includedNoteIds.add(
          noteId,
        )
      }
    }

    if (scope === 'connected') {
      // Union of the connected
      // graphs rooted at each
      // selected note; overlapping
      // graphs merge naturally.
      for (const noteId of selectedNoteIds) {
        for (const connectedId of getConnectedNoteIds(
          workspace,
          noteId,
        )) {
          includedNoteIds.add(
            connectedId,
          )
        }
      }
    }
  }

  const includedNotes =
    workspace.notes.filter(
      (note) =>
        includedNoteIds.has(
          note.id,
        ),
    )

  const includedConnections =
    workspace.connections.filter(
      (connection) =>
        includedNoteIds.has(
          connection.from,
        ) &&
        includedNoteIds.has(
          connection.to,
        ),
    )

  const lines: string[] = []

  lines.push('# PROJECT CONTEXT')
  lines.push('')

  const titleLine = `Project: ${workspace.title}`

  lines.push(titleLine)

  if (
    workspace.description.trim()
  ) {
    lines.push(
      workspace.description.trim(),
    )
  }

  lines.push('')

  if (
    workspace.documentation.length >
    0
  ) {
    lines.push('## DOCUMENTATION')
    lines.push('')

    for (const documentation of workspace.documentation) {
      lines.push(
        `- [${getDocumentationTypeLabel(
          documentation.type,
        )}] ${documentation.name} — ${documentation.url}`,
      )
    }

    lines.push('')
  }

  if (
    workspace.aiContext.trim()
  ) {
    lines.push('## GLOBAL AI CONTEXT')
    lines.push('')

    lines.push(
      workspace.aiContext.trim(),
    )

    lines.push('')
  }

  // Scope orientation lines:
  // multi-note copies list how
  // many notes were selected, and
  // connected copies name their
  // root notes. Single-note and
  // entire scopes are
  // self-explanatory.
  if (
    scope === 'current' &&
    selectedNoteIds.length > 1
  ) {
    lines.push(
      `Scope: ${selectedNoteIds.length} selected notes.`,
    )

    lines.push('')
  }

  if (
    scope === 'connected' &&
    selectedNoteIds.length > 0
  ) {
    const rootTitles =
      selectedNoteIds
        .map(
          (
            noteId,
          ) =>
            workspace.notes.find(
              (note) =>
                note.id ===
                noteId,
            ),
        )
        .filter(
          (
            note,
          ): note is Note =>
            Boolean(note),
        )
        .map(
          (note) =>
            `"${getNoteDisplayTitle(
              note,
            )}"`,
        )

    if (
      rootTitles.length ===
      1
    ) {
      lines.push(
        `Scope: connected graph rooted at ${rootTitles[0]}.`,
      )
    } else if (
      rootTitles.length >
      1
    ) {
      lines.push(
        `Scope: connected graphs rooted at ${rootTitles
          .slice(
            0,
            -1,
          )
          .join(', ')} and ${rootTitles[
          rootTitles.length -
            1
        ]}.`,
      )
    }

    lines.push('')
  }

  lines.push('## NOTES')
  lines.push('')

  if (
    includedNotes.length ===
    0
  ) {
    lines.push(
      '_No notes included in this context._',
    )

    lines.push('')
  }

  for (const note of includedNotes) {
    lines.push(
      `### ${getNoteDisplayTitle(
        note,
      )}`,
    )

    if (note.status) {
      lines.push('')

      lines.push(
        `Status: ${note.status}`,
      )
    }

    if (
      note.description.trim()
    ) {
      lines.push('')

      lines.push(
        note.description.trim(),
      )
    }

    if (
      note.filePaths.length >
      0
    ) {
      lines.push('')

      lines.push('Files:')

      for (const filePath of note.filePaths) {
        lines.push(
          `- ${filePath}`,
        )
      }
    }

    if (
      note.webUrl.trim()
    ) {
      lines.push('')

      lines.push(
        `Web: ${note.webUrl.trim()}`,
      )
    }

    if (
      note.images.length >
      0
    ) {
      lines.push('')

      lines.push('Images:')

      for (const image of note.images) {
        lines.push(
          `- ${image}`,
        )
      }
    }

    lines.push('')
  }

  if (
    includedConnections.length >
    0
  ) {
    lines.push('## RELATIONSHIPS')
    lines.push('')

    const uniqueRelationships =
      getUniqueRelationshipConnections(
        includedConnections,
      )

    for (const relationship of uniqueRelationships) {
      const fromNote =
        workspace.notes.find(
          (note) =>
            note.id ===
            relationship.from,
        )

      const toNote =
        workspace.notes.find(
          (note) =>
            note.id ===
            relationship.to,
        )

      if (
        !fromNote ||
        !toNote
      ) {
        continue
      }

      const bidirectional =
        areConnectionsBidirectional(
          workspace.connections,
          relationship,
        )

      const symbol =
        bidirectional
          ? '<->'
          : '->'

      lines.push(
        `- ${getNoteDisplayTitle(
          fromNote,
        )} ${symbol} ${getNoteDisplayTitle(
          toNote,
        )}`,
      )
    }

    lines.push('')
  }

  // Drop the trailing blank line
  // so the copy ends on content.
  while (
    lines.length > 0 &&
    lines[lines.length - 1] === ''
  ) {
    lines.pop()
  }

  return lines.join(
    '\n',
  )
}
