/**
 * `\8` and `\9` in a string are escapes that escape nothing: they stand for the digit itself,
 * are forbidden in strict code, and read as a typo for an octal escape.
 *
 * @module rules/javascript/no-nonoctal-decimal-escape
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'

export default defineRule<undefined, Node>({
  id: 'no-nonoctal-decimal-escape',
  language: 'code',
  fixable: false,
  create: (context) => ({
    Literal(node) {
      if (typeof node.value !== 'string') return
      const raw = node.raw as string
      // how: a backslash takes the code unit after it, so a backslash escaped by another is never read as an escape.
      for (let index = 0; index < raw.length; index += 1) {
        if (raw[index] !== '\\') continue
        index += 1
        const escaped = raw[index]
        if (escaped !== '8' && escaped !== '9') continue
        context.report({ start: node.start + index - 1, end: node.start + index + 1, message: `Don't use '\\${escaped}' escape sequence.` })
      }
    },
  }),
})
