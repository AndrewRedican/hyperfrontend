import { testRule } from '../../testing/rule-tester'
import rule from './check-types'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#85 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param {number} foo\n           * @param {Bar} bar\n           * @param {*} baz\n           */\n          function quux (foo, bar, baz) {\n\n          }\n      ',
    },
    {
      name: '#88 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param {typeof bar} foo\n           */\n          function qux(foo) {\n          }\n      ',
    },
    {
      name: '#89 /**',
      path: '/root/file.ts',
      text: "\n          /**\n           * @param {import('./foo').bar.baz} foo\n           */\n          function qux(foo) {\n          }\n      ",
    },
    {
      name: '#90 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param {(x: number, y: string) => string} foo\n           */\n          function qux(foo) {\n          }\n      ',
    },
    {
      name: '#110 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param {Number<} Ignore the error as not a validating rule\n           */\n          function quux (foo) {\n\n          }\n      ',
    },
    {
      name: '#111 /** @param {function(...)} callback The function to invoke. …',
      path: '/root/file.ts',
      text: '\n      /** @param {function(...)} callback The function to invoke. */\n      var subscribe = function(callback) {};\n      ',
    },
    {
      name: '#114 /** @type {new() => EntityBase} */',
      path: '/root/file.ts',
      text: '\n        /** @type {new() => EntityBase} */\n      ',
    },
    {
      name: '#120 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * @typedef {object} foo\n         */\n        function a () {}\n\n        /**\n         * @typedef {{[key: string]: number}} foo\n         */\n        function b () {}\n      ',
      settings: { jsdoc: { mode: 'typescript' } },
    },
    {
      name: '#124 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * Bad types handled by `valid-types` instead.\n           * @param {str(} foo\n           */\n          function quux (foo) {\n\n          }\n      ',
    },
    {
      name: '#132 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @param {string} text - The text\n * @param {Record<string, number>} counts - The counts\n * @param {bigint} big - A big integer\n * @param {symbol} key - A key\n * @param {Array<string>} list - The items\n * @param {Date} when - The date\n * @param {RegExp} pattern - The pattern\n * @param {Function} callback - The callback\n * @returns {Promise<boolean>} Whether it worked\n */\nfunction quux (text, counts, big, key, list, when, pattern, callback) {}\n',
    },
  ],
  invalid: [
    {
      name: '#4 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @arg {Number} foo\n           */\n          function quux (foo) {\n\n          }\n      ',
      errors: [{ message: 'Invalid JSDoc @arg "foo" type "Number"; prefer: "number".', line: 3, column: 1, endLine: 3, endColumn: 1 }],
      output: '\n          /**\n           * @arg {number} foo\n           */\n          function quux (foo) {\n\n          }\n      ',
    },
    {
      name: '#5 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @returns {Number} foo\n           * @throws {Number} foo\n           */\n          function quux () {\n\n          }\n      ',
      errors: [
        { message: 'Invalid JSDoc @returns type "Number"; prefer: "number".', line: 3, column: 1, endLine: 3, endColumn: 1 },
        { message: 'Invalid JSDoc @throws type "Number"; prefer: "number".', line: 4, column: 1, endLine: 4, endColumn: 1 },
      ],
      output:
        '\n          /**\n           * @returns {number} foo\n           * @throws {number} foo\n           */\n          function quux () {\n\n          }\n      ',
    },
    {
      name: '#6 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param {(Number | string | Boolean)=} foo\n           */\n          function quux (foo, bar, baz) {\n\n          }\n      ',
      errors: [
        { message: 'Invalid JSDoc @param "foo" type "Number"; prefer: "number".', line: 3, column: 1, endLine: 3, endColumn: 1 },
        { message: 'Invalid JSDoc @param "foo" type "Boolean"; prefer: "boolean".', line: 3, column: 1, endLine: 3, endColumn: 1 },
      ],
      output:
        '\n          /**\n           * @param {(number | string | boolean)=} foo\n           */\n          function quux (foo, bar, baz) {\n\n          }\n      ',
    },
    {
      name: '#8 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param {(Number | String)[]} foo\n           */\n          function quux (foo, bar, baz) {\n\n          }\n      ',
      errors: [
        { message: 'Invalid JSDoc @param "foo" type "Number"; prefer: "number".', line: 3, column: 1, endLine: 3, endColumn: 1 },
        { message: 'Invalid JSDoc @param "foo" type "String"; prefer: "string".', line: 3, column: 1, endLine: 3, endColumn: 1 },
      ],
      output:
        '\n          /**\n           * @param {(number | string)[]} foo\n           */\n          function quux (foo, bar, baz) {\n\n          }\n      ',
    },
    {
      name: '#56 /** @typedef {String} foo */',
      path: '/root/file.ts',
      text: '/** @typedef {String} foo */',
      errors: [{ message: 'Invalid JSDoc @typedef "foo" type "String"; prefer: "string".', line: 1, column: 1, endLine: 1, endColumn: 1 }],
      output: '/** @typedef {string} foo */',
    },
    {
      name: '#73 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * @param {object.<string>} foo\n         */\n        function quux (foo) {\n\n        }\n      ',
      settings: { jsdoc: { mode: 'typescript' } },
      errors: [
        {
          message: 'Use object shorthand or index signatures instead of `object`, e.g., `{[key: string]: string}`',
          line: 3,
          column: 1,
          endLine: 3,
          endColumn: 1,
        },
      ],
      output: null,
    },
    {
      name: '#74 /**',
      path: '/root/file.ts',
      text: "\n        /**\n         *\n         * @param {Object} param\n         * @return {Object | String}\n         */\n        function abc(param) {\n          if (param.a)\n            return {};\n          return 'abc';\n        }\n      ",
      errors: [
        { message: 'Invalid JSDoc @param "param" type "Object"; prefer: "object".', line: 4, column: 1, endLine: 4, endColumn: 1 },
        { message: 'Invalid JSDoc @return type "Object"; prefer: "object".', line: 5, column: 1, endLine: 5, endColumn: 1 },
        { message: 'Invalid JSDoc @return type "String"; prefer: "string".', line: 5, column: 1, endLine: 5, endColumn: 1 },
      ],
      output:
        "\n        /**\n         *\n         * @param {object} param\n         * @return {object | string}\n         */\n        function abc(param) {\n          if (param.a)\n            return {};\n          return 'abc';\n        }\n      ",
    },
  ],
})

testRule(rule, {
  valid: [],
  invalid: [
    {
      name: 'an Object nested in an Object generic',
      path: '/root/file.ts',
      text: '/**\n * @param {Object<string, Object>} a - A\n */',
      errors: [
        {
          message: 'Use object shorthand or index signatures instead of `Object`, e.g., `{[key: string]: string}`',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 1,
        },
      ],
    },
  ],
})
