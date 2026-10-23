import { testRule } from '../../testing/rule-tester'
import rule from './implements-on-classes'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#1 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @implements {SomeClass}\n       * @class\n       */\n      function quux () {\n\n      }\n      ',
    },
    {
      name: '#6 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       *\n       */\n      const quux = class {\n        /**\n         * @implements {SomeClass}\n         */\n        constructor () {\n\n        }\n      }\n      ',
    },
    {
      name: '#9 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @function\n       * @implements {SomeClass}\n       */\n      ',
    },
    { name: '#13 /**', path: '/root/file.ts', text: '\n/**\n * @implements {Shape}\n */\nconst value = 1\n' },
  ],
  invalid: [
    {
      name: '#21 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Draws the square.\n *\n * @implements {Shape}\n */\nconst draw = () => {}\n',
      errors: [{ message: '@implements used on a non-constructor function', line: 5, column: 1, endLine: 5, endColumn: 1 }],
    },
    {
      name: '#22 class Square {',
      path: '/root/file.ts',
      text: '\nclass Square {\n  /**\n   * @implements {Shape}\n   */\n  draw () {}\n}\n',
      errors: [{ message: '@implements used on a non-constructor function', line: 4, column: 1, endLine: 4, endColumn: 1 }],
    },
  ],
})
