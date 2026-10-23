/**
 * A switch case whose end control can reach falls into the next case; that is a mistake unless
 * a comment says it is meant.
 *
 * @module rules/javascript/no-fallthrough
 */

import type { Node, SourceToken } from '../../code/model'
import type { RuleFile } from '../../engine/rule'
import { commentsBetween, tokenBefore } from '../../code/source'
import { defineRule } from '../../engine/rule'
import { flowAnalysisOf } from '../../flow/analysis'
import { positionAt } from '../../text/lines'

/** The first words of the comments that are directives to a linter rather than remarks. */
const DIRECTIVE_WORDS = ['eslint', 'global', 'globals', 'exported', 'lint']

/**
 * Whether a comment's text says the fall-through is meant: `falls through`, `fall through` or
 * `fallthrough`, in any case, anywhere in it, unless the comment is a linter directive.
 *
 * @param text - The comment's text
 * @returns Whether it permits the fall-through
 */
function permitsFallthrough(text: string): boolean {
  const lower = text.toLowerCase()
  const word = lower.trim().split(/[\s-]/)[0] as string
  if (DIRECTIVE_WORDS.includes(word)) return false
  return lower.includes('fallthrough') || lower.includes('fall through') || lower.includes('falls through')
}

/**
 * The last comment between the token before an offset and the offset.
 *
 * @param file - The file linted
 * @param tree - The program
 * @param offset - The offset the comment precedes
 * @returns The comment's text, or null when none sits there
 */
function lastCommentBefore(file: RuleFile, tree: Node, offset: number): string | null {
  const previous = tokenBefore(tree, offset) as SourceToken
  const comments = commentsBetween(file, previous.end, offset)
  const last = comments[comments.length - 1]
  return last === undefined ? null : last.text
}

/**
 * Whether a case that falls through carries the comment permitting it: the last comment before
 * the next case, or the last comment before the closing brace of a block that is the case's only
 * statement.
 *
 * @param file - The file linted
 * @param tree - The program
 * @param falling - The case whose end control reaches
 * @param next - The case control falls into
 * @returns Whether the fall-through is permitted
 */
function hasFallthroughComment(file: RuleFile, tree: Node, falling: Node, next: Node): boolean {
  const statements = falling.consequent as readonly Node[]
  const only = statements.length === 1 ? (statements[0] as Node) : null
  if (only !== null && only.kind === 'BlockStatement') {
    const inBlock = lastCommentBefore(file, tree, only.end - 1)
    if (inBlock !== null && permitsFallthrough(inBlock)) return true
  }
  const before = lastCommentBefore(file, tree, next.start)
  return before !== null && permitsFallthrough(before)
}

export default defineRule<undefined, Node>({
  id: 'no-fallthrough',
  language: 'code',
  fixable: false,
  create(context) {
    return {
      SwitchStatement(node) {
        const flow = flowAnalysisOf(context)
        const cases = node.cases as readonly Node[]
        cases.forEach((next, index) => {
          if (index === 0) return
          const falling = cases[index - 1] as Node
          const reachable = flow.caseEnd(falling).some((segment) => segment.reachable)
          if (!reachable) return
          const statements = falling.consequent as readonly Node[]
          // why: an empty case falls through silently unless lines, blank or not, separate it from the next.
          const gap = positionAt(context.file.lines, next.start).line - positionAt(context.file.lines, falling.end).line
          if (statements.length === 0 && gap <= 1) return
          if (hasFallthroughComment(context.file, context.tree, falling, next)) return
          context.report({
            start: next.start,
            end: next.end,
            message: `Expected a 'break' statement before '${next.test === null ? 'default' : 'case'}'.`,
          })
        })
      },
    }
  },
})
