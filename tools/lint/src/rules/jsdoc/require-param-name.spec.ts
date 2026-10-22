import { testRule } from '../../testing/rule-tester.ts'
import rule from './require-param-name.ts'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#4 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @function\n           * @param\n           */\n      ',
    },
    {
      name: '#6 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @param {Function} [processor=data => data] A function to run\n       */\n      function processData(processor) {\n        return processor(data)\n      }\n      ',
    },
    {
      name: '#7 /** Example with multi-line param type.',
      path: '/root/file.ts',
      text: '\n      /** Example with multi-line param type.\n      *\n      * @param {function(\n      *   number\n      * )} cb Callback.\n      */\n      function example(cb) {\n        cb(42);\n      }\n      ',
    },
    {
      name: '#9 interface Calculator {',
      path: '/root/file.ts',
      text: '\ninterface Calculator {\n  /**\n   * @param {number}\n   */\n  push(value: number): void\n}\n',
    },
  ],
  invalid: [
    {
      name: '#12 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param {string}\n           */\n          function quux (foo) {\n\n          }\n      ',
      errors: [{ message: 'There must be an identifier after @param tag.', line: 3, column: 1, endLine: 3, endColumn: 1 }],
    },
    {
      name: '#17 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Adds a value.\n *\n * @param {number}\n * @param\n */\nexport declare function add(value: number, other: number): void\n',
      errors: [
        { message: 'There must be an identifier after @param tag.', line: 5, column: 1, endLine: 5, endColumn: 1 },
        { message: 'There must be an identifier after @param type.', line: 6, column: 1, endLine: 6, endColumn: 1 },
      ],
    },
  ],
})
