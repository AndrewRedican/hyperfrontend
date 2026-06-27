import { highlightCode } from '@/lib/shiki'
import { CopyButton } from './copy-button'

interface CodeBlockProps {
  /** The code content to display */
  code: string
  /** Optional language label; also drives syntax highlighting and the header. */
  language?: string
  /** Additional class name for top margin adjustment */
  className?: string
}

/**
 * A syntax-highlighted code block with copy-to-clipboard support.
 *
 * Highlighting is done at render time with Shiki (dual light/dark themes), so
 * this is an async server component; the copy control is a nested client
 * island ({@link CopyButton}). When no `language` is supplied the snippet is
 * still colorized as `bash` but the language header is hidden.
 * @param root0 - The props object containing code, language, and className.
 * @param root0.code - The code string to display inside the block.
 * @param root0.language - An optional language id, shown in the header and used for highlighting.
 * @param root0.className - An optional class for additional CSS, primarily margin adjustments.
 * @returns A JSX element rendering the highlighted code block with a copy button.
 */
export async function CodeBlock({ code, language, className = 'mt-4' }: CodeBlockProps) {
  const html = await highlightCode(code, language ?? 'bash')

  return (
    <div className={`group relative overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 ${className}`}>
      {language && (
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">{language}</span>
        </div>
      )}
      <div className="relative">
        <div dangerouslySetInnerHTML={{ __html: html }} />
        <CopyButton code={code} />
      </div>
    </div>
  )
}
