import type { AgentAction, AgentStamp, Language } from '../types'
import type { Translate, TranslationKey } from '../i18n'
import { formatDate } from './format'

const ACTIONS: Record<AgentAction, TranslationKey> = {
  answer: 'agentActionAnswer',
  status: 'agentActionStatus',
  create: 'agentActionCreate',
}

/** "Agent: claude-code · reviewer answered it on 30 Sep 2026, 9:14." The audit log has the rest. */
export function describeAgentStamp(t: Translate, language: Language, stamp: AgentStamp): string {
  return t('agentStamp', {
    agent: [stamp.client, stamp.id].filter(Boolean).join(' · '),
    action: t(ACTIONS[stamp.action]),
    when: formatDate(language, Date.parse(stamp.at), true),
  })
}
