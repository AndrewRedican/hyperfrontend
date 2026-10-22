import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-types.ts'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#3 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @function\n           * @param {number} foo\n           */\n      ',
    },
    {
      name: "#5 /*** Oops that's too many asterisks by accident **/",
      path: '/root/file.ts',
      text: "\n        /*** Oops that's too many asterisks by accident **/\n        function a () {}\n      ",
    },
    {
      name: '#7 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @param {string} value - Not a function block under the default contexts\n */\nconst value = 1\n',
    },
  ],
  invalid: [
    {
      name: '#10 class quux {',
      path: '/root/file.ts',
      text: '\n      class quux {\n        /**\n         * @param {number} foo\n         */\n        bar (foo) {\n\n        }\n      }\n      ',
      errors: [{ message: 'Types are not permitted on @param.', line: 4, column: 1, endLine: 4, endColumn: 1 }],
      output: '\n      class quux {\n        /**\n         * @param foo\n         */\n        bar (foo) {\n\n        }\n      }\n      ',
    },
    {
      name: '#17 export interface B {',
      path: '/root/file.ts',
      text: '\n        export interface B {\n          /**\n           * @param {string} paramA\n           */\n          methodB(paramB: string): void\n        }\n      ',
      errors: [{ message: 'Types are not permitted on @param.', line: 4, column: 1, endLine: 4, endColumn: 1 }],
      output:
        '\n        export interface B {\n          /**\n           * @param paramA\n           */\n          methodB(paramB: string): void\n        }\n      ',
    },
    {
      name: '#18 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * @class\n         * @property {object} x\n         */\n        class Example {\n          x: number;\n        }\n      ',
      errors: [{ message: 'Types are not permitted on @property in the supplied context.', line: 4, column: 1, endLine: 4, endColumn: 1 }],
      output:
        '\n        /**\n         * @class\n         * @property x\n         */\n        class Example {\n          x: number;\n        }\n      ',
    },
    {
      name: '#21 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Formats a value.\n *\n * @param {unknown} value - The value\n * @returns {string} The text\n */\nexport function format(value: unknown): string {\n  return String(value)\n}\n',
      errors: [
        { message: 'Types are not permitted on @param.', line: 5, column: 1, endLine: 5, endColumn: 1 },
        { message: 'Types are not permitted on @returns.', line: 6, column: 1, endLine: 6, endColumn: 1 },
      ],
      output:
        '\n/**\n * Formats a value.\n *\n * @param value - The value\n * @returns The text\n */\nexport function format(value: unknown): string {\n  return String(value)\n}\n',
    },
    {
      name: '#23 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @param {{\n *   radix: number\n * }} options - The options\n */\ndeclare function format(options: { radix: number }): string\n',
      errors: [{ message: 'Types are not permitted on @param.', line: 3, column: 1, endLine: 3, endColumn: 1 }],
      output: '\n/**\n * @param\n * \n *  options - The options\n */\ndeclare function format(options: { radix: number }): string\n',
    },
    {
      name: '#24 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @prop {string} name - The name\n */\nclass Shape {}\n',
      errors: [{ message: 'Types are not permitted on @prop in the supplied context.', line: 3, column: 1, endLine: 3, endColumn: 1 }],
      output: '\n/**\n * @prop name - The name\n */\nclass Shape {}\n',
    },
  ],
})
