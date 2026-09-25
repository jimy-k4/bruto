import { useEffect, useRef, useState } from 'react'
import { parseRichText } from '../domain/richText'
import { useI18n } from '../i18n'

/** Buttons inside a note mustn't start dragging it. */
const stop = (event: React.SyntheticEvent) => event.stopPropagation()

/** A piece of code with a button that copies it exactly. */
export function CodeBlock({ code, language }: { code: string; language?: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Without clipboard access the code can still be selected by hand.
    }
  }

  return (
    <div className="code-block">
      <div className="code-block__bar">
        <span className="code-block__language">{language || t('code')}</span>
        <button
          type="button"
          className="code-block__copy"
          onPointerDown={stop}
          onDoubleClick={stop}
          onClick={() => void copy()}
          aria-label={copied ? t('copied') : t('copyCode')}
        >
          <span aria-hidden="true">{copied ? t('copied') : t('copy')}</span>
        </button>
      </div>
      <pre className="code-block__code">
        <code>{code}</code>
      </pre>
    </div>
  )
}

/** Text with its code: blocks that can be copied, inline code set apart. */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`rich-text ${className ?? ''}`}>
      {parseRichText(text).map((block, index) =>
        block.kind === 'code' ? (
          <CodeBlock key={index} code={block.code} language={block.language} />
        ) : (
          <p key={index}>
            {block.parts.map((part, partIndex) =>
              part.kind === 'code' ? <code key={partIndex}>{part.value}</code> : part.value,
            )}
          </p>
        ),
      )}
    </div>
  )
}
