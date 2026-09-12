import type { CodeLayout } from '@/lib/code-layout'
import { classifyCodeLayout, CODE_LAYOUT_ATTRIBUTE } from '@/lib/code-layout'
import { highlightTokens } from '@/lib/code-tokens'
import { CyclingCode } from './cycling-code'

/** Props for {@link CyclingCodeBlock}. */
export interface CyclingCodeBlockProps {
  /** The commands, in the order they are shown; each is a complete, valid command on its own */
  commands: readonly string[]
  /** Optional language label; also drives syntax highlighting */
  language?: string
  /** Additional class name for top margin adjustment */
  className?: string
  /** The width the block is drawn at, when the automatic classification is wrong for it */
  layout?: CodeLayout
}

/**
 * A code block that cycles through several commands, typing each one out.
 *
 * The same block as {@link CodeBlock}, drawn the same way by the same
 * stylesheet, for the one case where a page has a set of interchangeable
 * commands rather than one: the block types a command, holds it, clears,
 * and types the next. It is a scripted example, not an animation dropped
 * into the page, and everything a reader can do with an ordinary block,
 * select it, copy it, tab to it, works here, with the copy control always
 * yielding the whole of the command currently chosen.
 *
 * Highlighting happens here, at render time, so this stays a server
 * component; the client half is the typing.
 * @param props - See {@link CyclingCodeBlockProps}.
 * @param props.commands - The commands, in the order they are shown
 * @param props.language - An optional language id, shown in the corner and used for highlighting
 * @param props.className - An optional class for additional CSS, primarily margin adjustments
 * @param props.layout - An explicit width mode, overriding the automatic classification
 * @returns The block.
 * @example The three demos, one command each
 * ```tsx
 * <CyclingCodeBlock commands={['npx nx dev demo-clock', 'npx nx dev demo-heartbeat', 'npx nx dev demo-koi-pond']} layout="full" />
 * ```
 */
export async function CyclingCodeBlock({ commands, language, className = 'mt-4', layout }: CyclingCodeBlockProps) {
  const frames = []
  for (const command of commands) {
    frames.push(await highlightTokens(command, language ?? 'bash'))
  }
  // why: the block is one width for every command it will show, so it is classified by the widest of them
  const widest = commands.reduce((longest, command) => (command.length > longest.length ? command : longest), '')

  return (
    <div className={`code-block group relative ${className}`} {...{ [CODE_LAYOUT_ATTRIBUTE]: classifyCodeLayout(widest, layout) }}>
      <CyclingCode frames={frames} language={language} />
    </div>
  )
}
