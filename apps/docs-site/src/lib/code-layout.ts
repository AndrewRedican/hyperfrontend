import type { ShikiTransformer } from 'shiki'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/**
 * How wide a code block is drawn: half the column it sits in, or all of it.
 *
 * Two modes rather than a width per block. A page whose samples were each
 * sized to their own text would read as a scatter of boxes; a page whose
 * samples are either compact or full reads as a system, and the reader
 * learns in one glance which of the two a block is.
 */
export type CodeLayout = 'compact' | 'full'

/**
 * Attribute the classification is published under, on the element the
 * stylesheet sizes: the highlighted `<pre>` inside rendered markdown, or the
 * wrapper the `CodeBlock` component draws around one.
 */
export const CODE_LAYOUT_ATTRIBUTE = 'data-code-layout'

/**
 * Longest line, in characters, a block may carry and still be compact.
 *
 * Calibrated against the site's own geometry rather than chosen in the
 * abstract. A compact block is half its column plus its own padding, and the
 * stylesheet only halves a column of 56rem or more, so the narrowest compact
 * block is 28rem of text: 448px, which holds 52 characters at the 14px
 * monospace the desktop renders in, whether that face is JetBrains Mono,
 * Menlo or Consolas. Wider columns give a compact block more room, never
 * less, so a line that fits at the threshold fits everywhere the mode is
 * used. Across the documentation corpus this is also where install commands,
 * short type aliases and one-line calls sit, and where import statements and
 * configuration objects start.
 */
export const COMPACT_MAX_LINE_LENGTH = 52

/**
 * Most lines a block may have and still be compact.
 *
 * Height is the other reason a block wants the whole column. A half-width
 * block of a dozen short lines is a tall narrow column beside a tall narrow
 * gap, and reads as an accident of layout rather than a choice: past a
 * handful of lines a sample is code to be read top to bottom, and it takes
 * the width that code takes.
 */
export const COMPACT_MAX_LINES = 6

/**
 * Columns a tab occupies when a line is measured, matching the `tab-size`
 * the stylesheet renders code blocks with.
 */
const TAB_COLUMNS = 4

/** Fence meta token an author sets the mode with, as `layout=compact` or `layout=full`. */
const LAYOUT_META_KEY = 'layout='

/** What a block's text says about its own shape. */
export interface CodeMeasure {
  /** Characters on the longest line, tabs counted as {@link TAB_COLUMNS} */
  longestLine: number
  /** Lines in the block, a trailing newline not counted as one */
  lineCount: number
}

/**
 * Measure a sample's width and height in characters and lines.
 *
 * @param code - The block's text, exactly as it will be rendered
 * @returns The longest line and the line count
 *
 * @example Measuring a three-line command
 * ```typescript
 * measureCode('git clone https://example.com/repo.git\ncd repo\nnpm install')
 * // { longestLine: 39, lineCount: 3 }
 * ```
 */
export function measureCode(code: string): CodeMeasure {
  const lines = code.replace(/\n$/, '').split('\n')
  return {
    longestLine: lines.reduce((widest, line) => max(widest, line.replace(/\t/g, ' '.repeat(TAB_COLUMNS)).length), 0),
    lineCount: lines.length,
  }
}

/**
 * Read an author's explicit choice of mode from a fence's meta string.
 *
 * The automatic classification is a rule about shape, and an author knows
 * things the shape does not say: that a short command belongs beside the
 * long one it is compared with, or that a five-line sample is the whole point
 * of its section. `layout=compact` and `layout=full` after the language name
 * say so; anything else in the meta string is left for whoever else reads it.
 *
 * @param meta - The fence's meta string, everything after the language
 * @returns The mode named, or undefined when the meta names none
 *
 * @example Overriding the classification from the fence
 * ```typescript
 * readLayoutOverride('layout=full')            // 'full'
 * readLayoutOverride('title="install" layout=compact') // 'compact'
 * readLayoutOverride('')                       // undefined
 * ```
 */
export function readLayoutOverride(meta: string): CodeLayout | undefined {
  for (const token of meta.split(/\s+/)) {
    if (!token.startsWith(LAYOUT_META_KEY)) continue
    const value = token.slice(LAYOUT_META_KEY.length)
    if (value === 'compact' || value === 'full') return value
  }
  return undefined
}

/**
 * Decide whether a block is drawn compact or full.
 *
 * Deterministic and content-based: the same text is always the same mode, on
 * every page and at every width, and nothing is measured in a browser. A
 * block is compact only when it is short in both directions, by
 * {@link COMPACT_MAX_LINE_LENGTH} and {@link COMPACT_MAX_LINES}; an author's
 * override wins over both.
 *
 * @param code - The block's text
 * @param override - The mode an author asked for, if any
 * @returns The mode the block is drawn in
 *
 * @example Classifying an install command and a module
 * ```typescript
 * classifyCodeLayout('npm install @hyperfrontend/features') // 'compact'
 * classifyCodeLayout(fortyLineModule)                       // 'full'
 * classifyCodeLayout('npm install x', 'full')               // 'full'
 * ```
 */
export function classifyCodeLayout(code: string, override?: CodeLayout): CodeLayout {
  if (override) return override
  const { longestLine, lineCount } = measureCode(code)
  return longestLine <= COMPACT_MAX_LINE_LENGTH && lineCount <= COMPACT_MAX_LINES ? 'compact' : 'full'
}

/**
 * Shiki transformer that stamps every highlighted block with its mode.
 *
 * Runs inside the highlighter, so the markdown pipeline classifies a block
 * from the same text it colours, and the fence's meta string, which the
 * pipeline carries to the highlighter as `metastring`, is where an override
 * is read from.
 *
 * @returns The transformer, to be listed among the highlighter's transformers
 *
 * @example Attaching it to the rehype highlighter
 * ```typescript
 * rehypeShiki({ themes, transformers: [codeLayoutTransformer()] })
 * ```
 */
export function codeLayoutTransformer(): ShikiTransformer {
  return {
    name: 'hyperfrontend:code-layout',
    pre(node) {
      const raw = this.options.meta?.['__raw']
      node.properties[CODE_LAYOUT_ATTRIBUTE] = classifyCodeLayout(this.source, readLayoutOverride(typeof raw === 'string' ? raw : ''))
    },
  }
}
