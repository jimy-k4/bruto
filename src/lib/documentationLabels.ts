import type { Translator } from '../i18n/translations'

export function getLocalizedDocumentationTypeLabel(
  type: 'obsidian' | 'notion' | 'web' | 'other',
  translate: Translator,
) {
  switch (type) {
    case 'obsidian':
      return translate('documentationTypeObsidian')

    case 'notion':
      return translate('documentationTypeNotion')

    case 'web':
      return translate('documentationTypeWeb')

    default:
      return translate('documentationTypeOther')
  }
}
