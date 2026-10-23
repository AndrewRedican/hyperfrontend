/**
 * A legacy octal literal, a `0` followed by digits, reads as a decimal to most eyes and is a
 * syntax error in strict code; `0o` spells an octal.
 *
 * @module rules/javascript/no-octal
 */

import type { Node } from '../../code/model'
import { defineRule } from '../../engine/rule'

/** A number whose text opens with a zero and a digit. */
const LEGACY_OCTAL = /^0[0-9]/

/** What is reported. */
const MESSAGE = 'Octal literals should not be used.'

export default defineRule<undefined, Node>({
  id: 'no-octal',
  language: 'code',
  fixable: false,
  create: (context) => ({
    Literal(node) {
      if (typeof node.value !== 'number') return
      // why: the scanner refuses a zero followed by a digit before any rule runs, so no text reaches the report; it stays so that the rule says what it stands for.
      /* node:coverage ignore next 1 */
      if (LEGACY_OCTAL.test(node.raw as string)) context.report({ start: node.start, end: node.end, message: MESSAGE })
    },
  }),
})
