import { testRule } from '../../testing/rule-tester'
import rule from './empty-tags'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#1 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @abstract\n           */\n          function quux () {\n\n          }\n      ',
    },
    {
      name: '#8 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * Create an array.\n       *\n       * @private\n       *\n       * @param {string[]} [elem] - Elements to make an array of.\n       * @param {boolean} [clone] - Optionally clone nodes.\n       * @returns {string[]} The array of nodes.\n       */\n      function quux () {}\n      ',
    },
    { name: '#12 /**', path: '/root/file.ts', text: '\n/**\n * @interface Shape - Only Closure mode requires it empty\n */\n' },
  ],
  invalid: [
    {
      name: '#16 class Test {',
      path: '/root/file.ts',
      text: '\n      class Test {\n          /**\n           * @abstract extra text\n           */\n          quux () {\n\n          }\n      }\n      ',
      errors: [{ message: '@abstract should be empty.', line: 4, column: 1, endLine: 4, endColumn: 1 }],
      output:
        '\n      class Test {\n          /**\n           * @abstract\n           */\n          quux () {\n\n          }\n      }\n      ',
    },
    {
      name: '#17 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @abstract extra text\n           * @inheritdoc\n           * @async out of place\n           */\n          function quux () {\n\n          }\n      ',
      errors: [
        { message: '@abstract should be empty.', line: 3, column: 1, endLine: 3, endColumn: 1 },
        { message: '@async should be empty.', line: 5, column: 1, endLine: 5, endColumn: 1 },
      ],
      output:
        '\n          /**\n           * @abstract\n           * @inheritdoc\n           * @async\n           */\n          function quux () {\n\n          }\n      ',
    },
    {
      name: '#19 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @private {someType}\n       */\n      function quux () {\n\n      }\n      ',
      errors: [{ message: '@private should be empty.', line: 3, column: 1, endLine: 3, endColumn: 1 }],
      output: '\n      /**\n       * @private\n       */\n      function quux () {\n\n      }\n      ',
    },
    {
      name: '#20 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @internal {someType}\n       */\n      function quux () {\n\n      }\n      ',
      errors: [{ message: '@internal should be empty.', line: 3, column: 1, endLine: 3, endColumn: 1 }],
      output: '\n      /**\n       * @internal\n       */\n      function quux () {\n\n      }\n      ',
    },
    {
      name: '#24 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @protected {string} reason\n */\nfunction quux () {}\n',
      errors: [{ message: '@protected should be empty.', line: 3, column: 1, endLine: 3, endColumn: 1 }],
      output: '\n/**\n * @protected\n */\nfunction quux () {}\n',
    },
  ],
})

testRule(rule, {
  valid: [],
  invalid: [
    {
      name: 'a marker with text on a one-line block after code',
      path: '/root/file.ts',
      text: 'f(/** @async later */ () => 1)',
      errors: [{ message: '@async should be empty.', line: 1, column: 1, endLine: 1, endColumn: 1 }],
      output: 'f(/** @async */ () => 1)',
    },
  ],
})
