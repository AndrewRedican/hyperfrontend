/**
 * A run of spaces in a regular expression is hard to count; a counted quantifier, ` {3}`, says
 * how many there are. Spaces inside a character class are left alone, and so is the last space
 * of a run when a quantifier already takes it.
 *
 * @module rules/javascript/no-regex-spaces
 */

import type { Node } from '../../code/model.ts'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule.ts'
import { visit } from '../../regex/model.ts'
import { parse } from '../../regex/parse.ts'
import { scopeAnalysisOf } from '../../scope/analysis.ts'
import { isRegExpIdentifier, stringLiteralValue } from './shared/regexp-construction.ts'

/** The characters that quantify the space before them. */
const QUANTIFIER_STARTS = createSet('+*{?'.split(''))

/** A span of the pattern. */
interface Span {
  /** The first offset. */
  readonly start: number
  /** The offset after the last. */
  readonly end: number
}

/** A run of spaces to report. */
interface Run {
  /** The offset of the first space. */
  readonly index: number
  /** How many spaces are counted. */
  readonly length: number
}

/**
 * The first run of two or more spaces outside every character class, less the space a
 * quantifier takes.
 *
 * @param pattern - The pattern text
 * @param classes - The spans of its character classes
 * @returns The run, or null when there is none
 */
function spaceRun(pattern: string, classes: readonly Span[]): Run | null {
  let index = 0
  while (index < pattern.length) {
    if (pattern[index] !== ' ') {
      index += 1
      continue
    }
    let end = index
    while (pattern[end] === ' ') end += 1
    const length = end < pattern.length && QUANTIFIER_STARTS.has(pattern[end] as string) ? end - index - 1 : end - index
    if (length >= 2 && !classes.some((span) => index >= span.start && index < span.end)) return { index, length }
    index = end
  }
  return null
}

export default defineRule<undefined, Node>({
  id: 'no-regex-spaces',
  language: 'code',
  fixable: true,
  create(context) {
    const check = (node: Node, pattern: string, flags: string, rawStart: number, raw: string): void => {
      const parsed = parse(pattern, flags).pattern
      if (parsed === null) return
      const classes: Span[] = []
      visit(parsed, (item) => {
        if (item.kind === 'CharacterClass') classes.push({ start: item.start, end: item.end })
      })
      // why: the runs are counted in the text as written, which is where the fix lands; the classes come from the pattern as read.
      const run = spaceRun(raw, classes)
      if (run === null) return
      context.report({
        start: node.start,
        end: node.end,
        message: `Spaces are hard to count. Use {${run.length}}.`,
        // why: the fix edits the source, which must spell the pattern as the engine reads it for the offsets to hold.
        fix:
          raw === pattern ? { start: rawStart + run.index, end: rawStart + run.index + run.length, text: ` {${run.length}}` } : undefined,
      })
    }
    const call = (node: Node): void => {
      if (!isRegExpIdentifier(scopeAnalysisOf(context), node.callee as Node)) return
      const [first, second] = node.arguments as readonly Node[]
      const pattern = stringLiteralValue(first)
      if (pattern === null) return
      const flags = second === undefined ? '' : stringLiteralValue(second)
      if (flags === null) return
      const literal = first as Node
      check(node, pattern, flags, literal.start + 1, context.file.text.slice(literal.start + 1, literal.end - 1))
    }
    return {
      Literal(node) {
        if (node.regex !== undefined) check(node, node.regex.pattern, node.regex.flags, node.start + 1, node.regex.pattern)
      },
      CallExpression: call,
      NewExpression: call,
    }
  },
})
