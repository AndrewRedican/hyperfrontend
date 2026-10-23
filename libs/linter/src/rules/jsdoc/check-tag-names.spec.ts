import { testRule } from '../../testing/rule-tester'
import rule from './check-tag-names'

// why: the workspace runs the rule with its two configured option sets, or a list of defined tags; the cases with other options or settings are left out.
testRule(rule, {
  valid: [
    {
      name: '#1 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param foo\n           */\n          function quux (foo) {\n\n          }\n      ',
    },
    {
      name: '#17 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * Registers the `target` class as a transient dependency; each time the dependency is resolved a new instance will be created.\n       *\n       * @param target - The class / constructor function to register as transient.\n       *\n       * @example ```ts\n      @transient()\n      class Foo { }\n      ```\n       * @param Time for a new tag\n       */\n      export function transient<T>(target?: T): T {\n        // ...\n      }\n',
    },
    {
      name: '#20 interface WebTwain {',
      path: '/root/file.ts',
      text: '\n        interface WebTwain {\n          /**\n           * Converts the images specified by the indices to base64 synchronously.\n           * @function WebTwain#ConvertToBase64\n           * @returns {Base64Result}\n\n          ConvertToBase64(): Base64Result;\n          */\n\n          /**\n           * Converts the images specified by the indices to base64 asynchronously.\n           * @function WebTwain#ConvertToBase64\n           * @returns {boolean}\n           */\n          ConvertToBase64(): boolean;\n        }\n      ',
    },
    {
      name: '#24 /**',
      path: '/root/file.ts',
      text: "\n/**\n * Formats a value. See {@link format} and {@linkcode Options}.\n *\n * @remarks Pure.\n * @template T - The value's type\n * @param value - The value\n * @returns The text\n * @throws {TypeError} When the value cannot be formatted\n * @example\n * format(1)\n * @see https://example.com\n * @since 1.0.0\n * @internal\n * @deprecated Use another one\n * @locked\n */\nexport function format<T>(value: T): string {\n  return String(value)\n}\n",
      options: { typed: false, definedTags: ['locked', 'module'] },
    },
    {
      name: '#27 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @abstract\n */\nclass Base {}\n',
      options: { typed: false, definedTags: ['locked', 'module'] },
    },
    {
      name: '#69 /** @abstract */',
      path: '/root/file.d.ts',
      text: '\n        /** @abstract */\n        { declare let a; }\n      ',
      options: { typed: true },
    },
    {
      name: '#70 function test() {',
      path: '/root/file.d.ts',
      text: '\n        function test() {\n          /** @abstract */\n          declare let a;\n        }\n      ',
      options: { typed: true },
    },
    {
      name: '#76 declare namespace Outer {',
      path: '/root/file.ts',
      text: '\ndeclare namespace Outer {\n  /** @function */\n  function inner(): void\n}\n',
      options: { typed: true },
    },
  ],
  invalid: [
    {
      name: '#29 /** @typoo {string} */',
      path: '/root/file.ts',
      text: '\n        /** @typoo {string} */\n        let a;\n      ',
      errors: [{ message: 'Invalid JSDoc tag name "typoo".', line: 2, column: 1, endLine: 2, endColumn: 1 }],
      output: null,
    },
    {
      name: '#45 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @property {object} a\n           * @prop {boolean} b\n           */\n          function quux () {\n\n          }\n      ',
      errors: [
        {
          message: 'Invalid JSDoc tag (preference). Replace "prop" JSDoc tag with "property".',
          line: 4,
          column: 1,
          endLine: 4,
          endColumn: 1,
        },
      ],
      output:
        '\n          /**\n           * @property {object} a\n           * @property {boolean} b\n           */\n          function quux () {\n\n          }\n      ',
    },
    {
      name: '#55 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * An {@inline sth} tag in the description and {@another} with a {@link}.\n         * @param {SomeType} name And an {@inlineTag} inside a tag description.\n         * @param {AnotherType} anotherName And yet {@another}\n         */\n      ',
      errors: [
        { message: 'Invalid JSDoc inline tag name "inline"', line: 3, column: 1, endLine: 3, endColumn: 1 },
        { message: 'Invalid JSDoc inline tag name "another"', line: 3, column: 1, endLine: 3, endColumn: 1 },
        { message: 'Invalid JSDoc inline tag name "inlineTag"', line: 4, column: 1, endLine: 4, endColumn: 1 },
        { message: 'Invalid JSDoc inline tag name "another"', line: 5, column: 1, endLine: 5, endColumn: 1 },
      ],
      output: null,
    },
    {
      name: '#82 /** @type {string} */ let a;',
      path: '/root/file.ts',
      text: '/** @type {string} */ let a;\n      ',
      options: { typed: true },
      errors: [{ message: "'@type' is redundant when using a type system.", line: 1, column: 1, endLine: 1, endColumn: 1 }],
      output: 'let a;\n      ',
    },
    {
      name: '#83 /** @type {string} */',
      path: '/root/file.ts',
      text: '/** @type {string} */\n        let a;\n      ',
      options: { typed: true },
      errors: [{ message: "'@type' is redundant when using a type system.", line: 1, column: 1, endLine: 1, endColumn: 1 }],
      output: '        let a;\n      ',
    },
    {
      name: '#86 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * Existing comment.\n         *  @type {string}\n         */\n        let a;\n      ',
      options: { typed: true },
      errors: [{ message: "'@type' is redundant when using a type system.", line: 4, column: 1, endLine: 4, endColumn: 1 }],
      output: '\n        /**\n         * Existing comment.\n         */\n        let a;\n      ',
    },
    {
      name: '#89 const a = {',
      path: '/root/file.ts',
      text: '\n        const a = {\n          /** @abstract */\n          b: true,\n        };\n      ',
      options: { typed: true },
      errors: [
        {
          message: "'@abstract' is redundant outside of ambient (`declare`/`.d.ts`) contexts when using a type system.",
          line: 3,
          column: 1,
          endLine: 3,
          endColumn: 1,
        },
      ],
      output: '\n        const a = {\n          b: true,\n        };\n      ',
    },
    {
      name: '#90 /** @template */',
      path: '/root/file.ts',
      text: '\n        /** @template */\n        let a;\n      ',
      options: { typed: true },
      errors: [
        { message: "'@template' without a name is redundant when using a type system.", line: 2, column: 1, endLine: 2, endColumn: 1 },
      ],
      output: '\n        let a;\n      ',
    },
    {
      name: '#92 /** @typedef {Object} MyObject',
      path: '/root/file.ts',
      text: '\n      /** @typedef {Object} MyObject\n       * @property {string} id - my id\n       */\n      ',
      options: { typed: true },
      errors: [
        { message: "'@typedef' is redundant when using a type system.", line: 2, column: 1, endLine: 2, endColumn: 1 },
        { message: "'@property' is redundant when using a type system.", line: 3, column: 1, endLine: 3, endColumn: 1 },
      ],
      output: '\n      /**\n       * id - my id\n       */\n      ',
    },
    {
      name: '#96 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Describes the value.\n * @static\n */\nexport const value = 1\n',
      options: { typed: true },
      errors: [
        {
          message: "'@static' is redundant outside of ambient (`declare`/`.d.ts`) contexts when using a type system.",
          line: 4,
          column: 1,
          endLine: 4,
          endColumn: 1,
        },
      ],
      output: '\n/**\n * Describes the value.\n */\nexport const value = 1\n',
    },
  ],
})
