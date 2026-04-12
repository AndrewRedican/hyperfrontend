'use client'

/**
 * Simple markdown-to-HTML converter for JSDoc descriptions.
 * @param markdown - The markdown text to convert
 * @returns HTML string
 */
function simpleMarkdownToHtml(markdown: string): string {
  if (!markdown) return ''

  let html = markdown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // why: inline code must be processed before bold/italic to avoid conflicts with backticks
  html = html.replace(/`([^`]+)`/g, '<code class="text-sm bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono">$1</code>')

  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')

  const lines = html.split('\n')
  const result: string[] = []
  let inBulletList = false
  let inNumberedList = false
  let listItems: string[] = []

  const flushList = () => {
    if (inBulletList) {
      result.push('<ul class="list-disc list-inside mt-2 space-y-1">')
      for (const item of listItems) {
        result.push(`<li>${item}</li>`)
      }
      result.push('</ul>')
    } else if (inNumberedList) {
      result.push('<ol class="list-decimal list-inside mt-2 space-y-1">')
      for (const item of listItems) {
        result.push(`<li>${item}</li>`)
      }
      result.push('</ol>')
    }
    inBulletList = false
    inNumberedList = false
    listItems = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/)

    if (trimmed.startsWith('- ')) {
      if (inNumberedList) flushList()
      if (!inBulletList) {
        inBulletList = true
        listItems = []
      }
      listItems.push(trimmed.slice(2))
    } else if (numberedMatch) {
      if (inBulletList) flushList()
      if (!inNumberedList) {
        inNumberedList = true
        listItems = []
      }
      listItems.push(numberedMatch[2])
    } else {
      flushList()

      if (trimmed === '') {
        if (
          result.length > 0 &&
          !result[result.length - 1].endsWith('</p>') &&
          !result[result.length - 1].endsWith('</ul>') &&
          !result[result.length - 1].endsWith('</ol>')
        ) {
          result.push('<br />')
        }
      } else {
        result.push(trimmed)
      }
    }
  }

  flushList()

  return result.join(' ')
}

interface DescriptionMarkdownProps {
  /** The markdown text to render */
  text: string
  /** Additional CSS classes */
  className?: string
}

/**
 * Renders JSDoc description text with markdown support.
 * @param props - Component props
 * @param props.text - The markdown text to render
 * @param props.className - Additional CSS classes
 * @returns React element or null if text is empty
 * @example
 * ```tsx
 * <DescriptionMarkdown
 *   text="Steps:\n1. Initialize\n2. Connect\n- Option A\n- Option B"
 *   className="text-sm text-slate-600"
 * />
 * ```
 */
export function DescriptionMarkdown({ text, className = '' }: DescriptionMarkdownProps) {
  if (!text) return null

  const html = simpleMarkdownToHtml(text)

  return <div className={`description-markdown ${className}`} dangerouslySetInnerHTML={{ __html: html }} />
}
