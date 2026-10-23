import { testRule } from '../../testing/rule-tester'
import rule from './require-returns-description'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#8 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @function\n           * @returns\n           */\n      ',
    },
    { name: '#11 /**', path: '/root/file.ts', text: '\n/**\n * @returns { Promise<void> }\n */\nasync function flush () {}\n' },
  ],
  invalid: [
    {
      name: '#20 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Doubles a number.\n *\n * @param value - The number\n * @returns\n */\nexport const double = (value: number): number => value * 2\n',
      errors: [{ message: 'Missing JSDoc @returns description.', line: 6, column: 1, endLine: 6, endColumn: 1 }],
    },
    {
      name: '#21 class Widget {',
      path: '/root/file.ts',
      text: '\nclass Widget {\n  /**\n   * @returns {number}\n   */\n  size () {\n    return 1\n  }\n}\n',
      errors: [{ message: 'Missing JSDoc @returns description.', line: 4, column: 1, endLine: 4, endColumn: 1 }],
    },
    {
      name: '#23 /**',
      path: '/root/file.ts',
      text: "\n/**\n * @returns {string}\n * @returns\n */\nfunction name () {\n  return 'x'\n}\n",
      errors: [
        { message: 'Missing JSDoc @returns description.', line: 3, column: 1, endLine: 3, endColumn: 1 },
        { message: 'Missing JSDoc @returns description.', line: 4, column: 1, endLine: 4, endColumn: 1 },
      ],
    },
    {
      name: '#24 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @returns {string}\n */\ndeclare function name (): string\n',
      errors: [{ message: 'Missing JSDoc @returns description.', line: 3, column: 1, endLine: 3, endColumn: 1 }],
    },
  ],
})
