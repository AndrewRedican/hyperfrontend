import { testRule } from '../../testing/rule-tester.ts'
import rule from './reject-any-type.ts'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#2 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @param value - The value\n * @returns The same value\n */\nexport function identity(value: unknown): unknown {\n  return value\n}\n',
    },
  ],
  invalid: [
    {
      name: '#7 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * @param {string|Promise<any>} abc\n         */\n        function quux () {}\n      ',
      errors: [{ message: 'Prefer a more specific type to `any`', line: 3, column: 1, endLine: 3, endColumn: 1 }],
    },
    {
      name: '#10 /** @type {Record<string, *>} */',
      path: '/root/file.ts',
      text: '\n/** @type {Record<string, *>} */\nconst value = {}\n',
      errors: [{ message: 'Prefer a more specific type to `*`', line: 2, column: 1, endLine: 2, endColumn: 1 }],
    },
    {
      name: '#11 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @param {any} first\n * @param {*} second\n */\nfunction quux (first, second) {}\n',
      errors: [
        { message: 'Prefer a more specific type to `any`', line: 3, column: 1, endLine: 3, endColumn: 1 },
        { message: 'Prefer a more specific type to `*`', line: 4, column: 1, endLine: 4, endColumn: 1 },
      ],
    },
  ],
})
