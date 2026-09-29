import { useEffect, useRef, useState } from 'react'
import { parseRichText, type Block, type Inline, type ListBlock } from '../domain/richText'
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

function renderInline(parts: Inline[]): React.ReactNode[] {
  return parts.map((part, index) => {
    switch (part.kind) {
      case 'text':
        return part.value
      case 'code':
        return <code key={index}>{part.value}</code>
      case 'strong':
        return <strong key={index}>{renderInline(part.children)}</strong>
      case 'em':
        return <em key={index}>{renderInline(part.children)}</em>
      case 'strike':
        return <s key={index}>{renderInline(part.children)}</s>
      case 'link':
        return (
          <a
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            onPointerDown={stop}
            onDoubleClick={stop}
          >
            {renderInline(part.children)}
          </a>
        )
    }
  })
}

function List({ list }: { list: ListBlock }) {
  const items = list.items.map((item, index) => (
    <li key={index}>
      {renderInline(item.parts)}
      {item.lists.map((nested, nestedIndex) => (
        <List key={nestedIndex} list={nested} />
      ))}
    </li>
  ))

  return list.ordered ? <ol start={list.start}>{items}</ol> : <ul>{items}</ul>
}

// The note's title is an h3: the text's own headings go under it.
const HEADING_TAGS = ['h4', 'h5', 'h6'] as const

function Blocks({ blocks }: { blocks: Block[] }) {
  return blocks.map((block, index) => {
    switch (block.kind) {
      case 'paragraph':
        return <p key={index}>{renderInline(block.parts)}</p>
      case 'heading': {
        const depth = Math.min(block.level, HEADING_TAGS.length)
        const Heading = HEADING_TAGS[depth - 1]

        return (
          <Heading key={index} className={`rich-text__heading rich-text__heading--${depth}`}>
            {renderInline(block.parts)}
          </Heading>
        )
      }
      case 'list':
        return <List key={index} list={block} />
      case 'quote':
        return (
          <blockquote key={index}>
            <Blocks blocks={block.blocks} />
          </blockquote>
        )
      case 'table':
        return (
          <table key={index}>
            <thead>
              <tr>
                {block.head.map((cell, column) => (
                  <th key={column} style={{ textAlign: block.align[column] ?? undefined }}>
                    {renderInline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, column) => (
                    <td key={column} style={{ textAlign: block.align[column] ?? undefined }}>
                      {renderInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )
      case 'rule':
        return <hr key={index} />
      case 'code':
        return <CodeBlock key={index} code={block.code} language={block.language} />
    }
  })
}

/** Text written in Markdown: headings, lists, tables…, and code in blocks that can be copied. */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={`rich-text ${className ?? ''}`}>
      <Blocks blocks={parseRichText(text)} />
    </div>
  )
}
