import { testRule } from '../../testing/rule-tester'
import rule from './require-param-description'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#1 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function quux (foo) {\n\n          }\n      ',
    },
    {
      name: '#4 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @function\n           * @param foo\n           */\n      ',
    },
    {
      name: '#6 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * Checks if the XML document sort of equals another XML document.\n       * @param {Object} obj The other object.\n       * @param {{includeWhiteSpace: (boolean|undefined),\n       *    ignoreElementOrder: (boolean|undefined)}} [options] The options.\n       * @return {expect.Assertion} The assertion.\n       */\n      expect.Assertion.prototype.xmleql = function (obj, options) {\n      }\n      ',
    },
    {
      name: '#10 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Adds two numbers.\n *\n * @param left - The first addend\n * @param right - The second addend\n * @returns The sum\n */\nexport function add(left: number, right: number): number {\n  return left + right\n}\n',
    },
    {
      name: '#11 interface Calculator {',
      path: '/root/file.ts',
      text: '\ninterface Calculator {\n  /**\n   * @param value\n   */\n  push(value: number): void\n}\n',
    },
  ],
  invalid: [
    {
      name: '#23 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Adds a value.\n *\n * @param value\n */\nexport declare function add(value: number): void\n',
      errors: [{ message: 'Missing JSDoc @param "value" description.', line: 5, column: 1, endLine: 5, endColumn: 1 }],
    },
    {
      name: '#24 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @param\n */\nconst quux = function () {}\n',
      errors: [{ message: 'Missing JSDoc @param "" description.', line: 3, column: 1, endLine: 3, endColumn: 1 }],
    },
  ],
})
