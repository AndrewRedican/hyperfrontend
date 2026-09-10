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
 * still colorized as `bash` but nothing is labelled.
 *
 * The block carries no frame of its own. Everything a code block looks like
 * lives on `pre.shiki` in the stylesheet, which is the one element both this
 * component and a rendered README end up producing, so the two cannot drift
 * into two different treatments. The language is a label over the corner rather
 * than a header bar above the block, matching what the README path draws.
 * @param root0 - The props object containing code, language, and className.
 * @param root0.code - The code string to display inside the block.
 * @param root0.language - An optional language id, shown in the corner and used for highlighting.
 * @param root0.className - An optional class for additional CSS, primarily margin adjustments.
 * @returns A JSX element rendering the highlighted code block with a copy button.
 */
export async function CodeBlock({ code, language, className = 'mt-4' }: CodeBlockProps) {
  const html = await highlightCode(code, language ?? 'bash')

  return (
    <div className={`group relative ${className}`}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {language && (
        <span className="code-language" aria-hidden="true">
          {language}
        </span>
      )}
      <CopyButton code={code} />
    </div>
  )
}
