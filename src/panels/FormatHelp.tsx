import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n, type Translate } from '../i18n'
import { Dialog } from '../ui/Dialog'
import { RichText } from '../ui/RichText'

/** What to type, one example per kind of formatting, in the reader's language. */
const examples = (t: Translate) => [
  `# ${t('fmtHeading')}\n## ${t('fmtHeading')}`,
  // `code` alone on its line would be a block to copy: inline, it goes in a sentence.
  `**${t('fmtBold')}**, *${t('fmtItalic')}*, ~~${t('fmtStrike')}~~, \`${t('fmtCode')}\``,
  `- ${t('fmtItem')}\n- ${t('fmtItem')}\n  - ${t('fmtSubitem')}`,
  `1. ${t('fmtStep')}\n2. ${t('fmtStep')}`,
  `[${t('fmtLink')}](https://example.com)`,
  '```\nnpm test\n```',
  `> ${t('fmtQuote')}`,
  `| ${t('fmtTask')} | ${t('fmtStatus')} |\n| --- | :-: |\n| Login | ✓ |`,
  '---',
]

/** A link that opens a sheet of the Markdown notes understand, each example next to how it looks. */
export function FormatHelp() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" className="link-button field__help" onClick={() => setOpen(true)}>
        {t('formatHelp')}
      </button>

      {open &&
        // Outside the side panel, so the window covers the whole app.
        createPortal(
          <Dialog
            eyebrow={t('formatHelp')}
            title={t('formatHelpTitle')}
            description={t('formatHelpDescription')}
            onClose={() => setOpen(false)}
            size="large"
          >
            <table className="format-help">
              <thead>
                <tr>
                  <th scope="col">{t('formatHelpWrite')}</th>
                  <th scope="col">{t('formatHelpSee')}</th>
                </tr>
              </thead>
              <tbody>
                {examples(t).map((example) => (
                  <tr key={example}>
                    <td>
                      <pre className="format-help__source">{example}</pre>
                    </td>
                    <td>
                      <RichText text={example} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="field__hint">{t('formatHelpLineBreaks')}</p>
          </Dialog>,
          document.body,
        )}
    </>
  )
}
