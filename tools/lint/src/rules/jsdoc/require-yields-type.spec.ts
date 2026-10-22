import { testRule } from '../../testing/rule-tester.ts'
import rule from './require-yields-type.ts'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    { name: '#1 /**', path: '/root/file.ts', text: '\n        /**\n         * @yields {SomeType}\n         */\n      ' },
    {
      name: '#2 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Counts upwards.\n *\n * @yields {number} The next count\n */\nexport function * count(): Generator<number> {\n  yield 1\n}\n',
    },
    { name: '#3 /**', path: '/root/file.ts', text: "\n/**\n * @yield {string} A label\n */\nfunction * labels () {\n  yield 'x'\n}\n" },
  ],
  invalid: [
    {
      name: '#5 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * @yields\n         */\n      ',
      errors: [{ message: '@yields should have a type', line: 2, column: 9, endLine: 4, endColumn: 12 }],
    },
    {
      name: '#8 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @yields {number} The typed one\n * @yield The untyped one\n */\nfunction * count () {\n  yield 1\n}\n',
      errors: [{ message: '@yields should have a type', line: 2, column: 1, endLine: 5, endColumn: 4 }],
    },
    {
      name: '#9 class Widget {',
      path: '/root/file.ts',
      text: '\nclass Widget {\n  /**\n   * @yields A part\n   */\n  * parts () {\n    yield 1\n  }\n}\n',
      errors: [{ message: '@yields should have a type', line: 3, column: 3, endLine: 5, endColumn: 6 }],
    },
  ],
})
