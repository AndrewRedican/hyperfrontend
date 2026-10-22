/**
 * No ASCII-art diagrams in Markdown: a fenced block drawn with box characters, with corners and
 * at least two bordered lines, is reported, with a message that points a README at the
 * architecture document, since npm renders no Mermaid.
 *
 * @module rules/workspace/no-ascii-art-diagrams
 */

import type { RuleContext } from '../../engine/rule.ts'
import type { MarkdownNode } from '../../markdown/model.ts'
import { basename } from 'node:path'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule.ts'

/** The characters a diagram is drawn with. */
const BOX = createSet([...'┌┐└┘│─├┤┬┴┼╔╗╚╝║═╠╣╦╩╬+|'])

/** The right-hand characters a directory tree never uses. */
const RIGHT = createSet([...'┐┘┤╗╝╣'])

/** The corner a box opens with. */
const TOP_LEFT = createSet([...'┌╔'])

const HORIZONTAL = createSet([...'─═┬┴╦╩┼╬'])
const VERTICAL = createSet([...'│║├┤╠╣┼╬'])

const MIN_DIAGRAM_LINES = 3
const MIN_CHARS_PER_LINE = 2

const README_MESSAGE =
  'ASCII art diagrams are not allowed in README.md. npm does not render Mermaid diagrams, so link to ARCHITECTURE.md or other documentation files instead.'
const DOCS_MESSAGE =
  'ASCII art diagrams are not allowed. Use Mermaid diagrams instead for better rendering, accessibility, and maintainability.'

/**
 * Whether any character of a line is in a set.
 *
 * @param line - The line of the block being read
 * @param set - The characters looked for
 * @returns True when one is found
 */
function hasAny(line: string, set: ReadonlySet<string>): boolean {
  return [...line].some((char) => set.has(char))
}

/**
 * Whether a line is drawn as part of a box.
 *
 * @param line - The line of the block being read
 * @returns True for two or more box characters with a border or a corner among them
 */
function isDiagramLine(line: string): boolean {
  if ([...line].filter((char) => BOX.has(char)).length < MIN_CHARS_PER_LINE) return false
  return hasAny(line, HORIZONTAL) || hasAny(line, VERTICAL) || hasAny(line, RIGHT) || hasAny(line, TOP_LEFT)
}

/**
 * Whether drawn lines form a box rather than a directory tree: a right-hand character, an
 * opening corner, and two bordered lines.
 *
 * @param lines - The drawn lines of a block
 * @returns True for a box
 */
function isBox(lines: readonly string[]): boolean {
  return (
    lines.some((line) => hasAny(line, RIGHT)) &&
    lines.some((line) => hasAny(line, TOP_LEFT)) &&
    lines.filter((line) => hasAny(line, VERTICAL)).length >= 2
  )
}

export default defineRule<undefined, MarkdownNode>({
  id: 'workspace/no-ascii-art-diagrams',
  language: 'markdown',
  fixable: false,
  create(context: RuleContext<undefined, MarkdownNode>) {
    const message = basename(context.file.path) === 'README.md' ? README_MESSAGE : DOCS_MESSAGE
    return {
      root() {
        const lines = context.file.text.split(/\r?\n/)
        let opened = -1
        let offset = 0
        let openedOffset = 0
        lines.forEach((line, index) => {
          if (line.trim().startsWith('```')) {
            if (opened === -1) {
              opened = index
              openedOffset = offset + line.length + 1
            } else {
              const block = lines.slice(opened + 1, index)
              const drawn = block.filter(isDiagramLine)
              if (block.length >= MIN_DIAGRAM_LINES && drawn.length >= MIN_DIAGRAM_LINES && isBox(drawn)) {
                context.report({ start: openedOffset, message, at: { line: opened + 2, column: 0, endLine: index + 1, endColumn: 0 } })
              }
              opened = -1
            }
          }
          offset += line.length + 1
        })
      },
    }
  },
})
