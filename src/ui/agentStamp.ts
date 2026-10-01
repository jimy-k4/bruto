import type { AgentAction, AgentStamp, Language } from '../types'
import type { Translate, TranslationKey } from '../i18n'
import { formatDate } from './format'

const ACTIONS: Record<AgentAction, TranslationKey> = {
  answer: 'agentActionAnswer',
  status: 'agentActionStatus',
  create: 'agentActionCreate',
}

/** Note fields by the name the editor gives them. */
const FIELDS: Partial<Record<string, TranslationKey>> = {
  title: 'title',
  description: 'description',
  status: 'status',
  kind: 'kind',
  filePaths: 'files',
  aiResponse: 'aiResponse',
  aiFilePaths: 'aiFiles',
  feedback: 'feedback',
}

/** "Estado", "Respuesta de la IA": a note field as the editor labels it, or its own name. */
export function fieldLabel(t: Translate, field: string): string {
  const key = FIELDS[field]

  return key ? t(key) : field
}

/**
 * "Agent: claude-code · reviewer answered it on 30 Sep 2026, 9:14." And, when
 * the user's edit replaced part of that change, which part. The audit log has the rest.
 */
/** "claude-code · reviewer": the client, and the agent id when it gave one. */
export const agentName = (stamp: AgentStamp) => [stamp.client, stamp.id].filter(Boolean).join(' · ')

export function describeAgentStamp(t: Translate, language: Language, stamp: AgentStamp): string {
  const text = t('agentStamp', {
    agent: agentName(stamp),
    action: t(ACTIONS[stamp.action]),
    when: formatDate(language, Date.parse(stamp.at), true),
  })

  return stamp.reverted?.length
    ? `${text} ${t('agentReverted', {
        fields: stamp.reverted.map((change) => fieldLabel(t, change.field)).join(', '),
      })}`
    : text
}
