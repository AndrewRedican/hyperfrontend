import { testRule } from '../../testing/rule-tester'
import rule from './require-throws-type'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#2 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Parses a value.\n *\n * @param text - The text\n * @returns The value\n * @throws {SyntaxError} When the text is not JSON\n */\nexport function parse(text: string): unknown {\n  return JSON.parse(text)\n}\n',
    },
  ],
  invalid: [
    {
      name: '#5 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * @throws\n         */\n      ',
      errors: [{ message: '@throws should have a type', line: 2, column: 9, endLine: 4, endColumn: 12 }],
    },
    {
      name: '#9 class Widget {',
      path: '/root/file.ts',
      text: "\nclass Widget {\n  /**\n   * @throws Always\n   */\n  fail () {\n    throw new Error('x')\n  }\n}\n",
      errors: [{ message: '@throws should have a type', line: 3, column: 3, endLine: 5, endColumn: 6 }],
    },
  ],
})
