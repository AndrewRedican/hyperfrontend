/**
 * A control character in a regular expression, written as a `\x` or `\u` escape or as itself,
 * is almost never meant; the readable control escapes such as `\t` are left alone.
 *
 * @module rules/javascript/no-control-regex
 */

import type { Node } from '../../code/model'
import type { CharacterNode } from '../../regex/model'
import { defineRule } from '../../engine/rule'
import { parse } from '../../regex/parse'
import { scopeAnalysisOf } from '../../scope/analysis'
import { isRegExpIdentifier, stringLiteralValue } from './shared/regexp-construction'

/** The highest code point of the control range reported. */
const LAST_CONTROL = 0x1f

/**
 * Whether a character is a control character written as a hexadecimal or unicode escape, or as itself.
 *
 * @param node - The character tested
 * @returns Whether it is reported
 */
function isControl(node: CharacterNode): boolean {
  return node.value <= LAST_CONTROL && (node.raw.length === 1 || node.raw.startsWith('\\x') || node.raw.startsWith('\\u'))
}

/**
 * The control characters a pattern holds, as `\xHH`, in order; those read before a syntax fault count.
 *
 * @param pattern - The pattern text
 * @param flags - Its flags
 * @returns The escapes
 */
function controlCharacters(pattern: string, flags: string): string[] {
  return parse(pattern, flags)
    .characters.filter(isControl)
    .map((node) => `\\x${node.value.toString(16).padStart(2, '0')}`)
}

export default defineRule<undefined, Node>({
  id: 'no-control-regex',
  language: 'code',
  fixable: false,
  create(context) {
    const check = (node: Node, pattern: string, flags: string): void => {
      const found = controlCharacters(pattern, flags)
      if (found.length === 0) return
      context.report({
        start: node.start,
        end: node.end,
        message: `Unexpected control character(s) in regular expression: ${found.join(', ')}.`,
      })
    }
    const call = (node: Node): void => {
      if (!isRegExpIdentifier(scopeAnalysisOf(context), node.callee as Node)) return
      const [first, second] = node.arguments as readonly Node[]
      const pattern = stringLiteralValue(first)
      if (pattern !== null) check(first as Node, pattern, stringLiteralValue(second) ?? '')
    }
    return {
      Literal(node) {
        if (node.regex !== undefined) check(node, node.regex.pattern, node.regex.flags)
      },
      CallExpression: call,
      NewExpression: call,
    }
  },
})
