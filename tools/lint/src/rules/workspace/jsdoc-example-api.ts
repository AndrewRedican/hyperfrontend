/**
 * A code example in a JSDoc block uses API that exists: what a fenced block or an `@example`
 * takes from a workspace package, by an import, a re-export, a `require`, a namespace or a
 * bundle's global, is exported by the entry point it names.
 *
 * @module rules/workspace/jsdoc-example-api
 */

import type { Node, SourceComment } from '@hyperfrontend/linter'
import type { Example } from './shared/example-api.ts'
import { dirname, join } from 'node:path'
import { defineRule } from '@hyperfrontend/linter'
import { workspaceRootOf } from '@hyperfrontend/workspace/lint'
import { docsIndex } from './shared/docs-catalog.ts'
import { EXTENSIONS, checkExample } from './shared/example-api.ts'

/** The lines of one example while a comment is read. */
interface Block {
  /** The language its fence names; none for an example written without a fence. */
  readonly language: string
  /** Its lines, without the comment's margin. */
  readonly lines: string[]
  /** Where each line begins in the file. */
  readonly lineStarts: number[]
}

/** The margin a line of a JSDoc block carries before its text: indentation, the star, and one space. */
const MARGIN = /^[ \t]*\*?[ \t]?/

/** The opening and closing of a fence. */
const FENCE = '```'

/**
 * Reads the examples a JSDoc block holds: every fenced block, and the text of an `@example` that
 * is written without a fence.
 *
 * @param comment - A comment whose text opens with the star of a JSDoc block
 * @returns The examples, in order
 */
function examplesOf(comment: SourceComment): Block[] {
  const examples: Block[] = []
  let fenced: Block | null = null
  let bare: Block | null = null
  let cursor = 0
  for (const raw of comment.text.split(/\r?\n/)) {
    const margin = (MARGIN.exec(raw) as RegExpExecArray)[0].length
    const line = raw.slice(margin)
    // why: a comment's text starts after its two delimiter characters.
    const start = comment.start + 2 + cursor + margin
    // why: the split dropped the line break, which is two characters in a file with carriage returns.
    cursor += raw.length + (comment.text[cursor + raw.length] === '\r' ? 2 : 1)
    const opens = line.trimStart().startsWith(FENCE)
    if (fenced !== null) {
      if (opens) {
        examples.push(fenced)
        fenced = null
      } else {
        fenced.lines.push(line)
        fenced.lineStarts.push(start)
      }
    } else if (opens) {
      // why: an example that fences its code keeps prose around the fence, so only the fence is code.
      bare = null
      fenced = { language: line.trimStart().slice(FENCE.length).trim().split(/\s+/)[0] as string, lines: [], lineStarts: [] }
    } else if (line.trimStart().startsWith('@')) {
      if (bare !== null) examples.push(bare)
      bare = /^@example\b/i.test(line.trimStart()) ? { language: '', lines: [], lineStarts: [] } : null
    } else if (bare !== null) {
      bare.lines.push(line)
      bare.lineStarts.push(start)
    }
  }
  if (bare !== null) examples.push(bare)
  return examples
}

export default defineRule<undefined, Node>({
  id: 'workspace/jsdoc-example-api',
  language: 'code',
  fixable: false,
  create(context) {
    const root = workspaceRootOf(dirname(context.file.path))
    if (root === null) return {}
    const index = docsIndex(root, join(root, 'apps/docs-site'))
    return {
      Program() {
        for (const comment of context.file.comments) {
          if (!comment.text.startsWith('*') || context.file.text[comment.start + 1] !== '*') continue
          for (const block of examplesOf(comment)) {
            // why: an example names its language or is TypeScript, as the code around it is.
            const extension = block.language === '' ? '.ts' : EXTENSIONS[block.language.toLowerCase()]
            if (extension === undefined) continue
            // why: an example beside the code it describes shows that code in a setting, and the setting's functions are the reader's: calls are left alone here.
            const example: Example = { text: block.lines.join('\n'), extension, lineStarts: block.lineStarts, own: null }
            checkExample(index, example, (start, end, message) => context.report({ start, end, message }))
          }
        }
      },
    }
  },
})
