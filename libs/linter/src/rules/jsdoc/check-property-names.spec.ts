import { testRule } from '../../testing/rule-tester'
import rule from './check-property-names'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    { name: '#1 /**', path: '/root/file.ts', text: '\n          /**\n           *\n           */\n      ' },
    {
      name: '#5 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @typedef (SomeType) SomeTypedef\n           * @property foo\n           * @property foo.foo\n           * @property bar\n           */\n      ',
    },
    {
      name: '#9 /**',
      path: '/root/file.ts',
      text: "\n          /**\n           * @class\n           * @property {Error} error Exit code\n           * @property {number} [code = 1] Exit code\n           */\n          function quux (code = 1) {\n            this.error = new Error('oops');\n            this.code = code;\n          }\n      ",
    },
  ],
  invalid: [
    {
      name: '#29 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * @typedef {object} foo\n         * @property {string} type\n         *\n         * @typedef {object} bar\n         * @property {object} abc\n         * @property {number} abc.def\n         * @property {number} abc.def\n         */\n      ',
      errors: [{ message: 'Duplicate @property "abc.def"', line: 9, column: 1, endLine: 9, endColumn: 1 }],
    },
    {
      name: '#35 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @typedef {object} Shape\n * @property {object[]} items - The items\n * @property {string} other[].id - A path under another root\n */\n',
      errors: [
        {
          message:
            '@property path declaration ("other[].id") root node name ("other") does not match previous real property name ("items").',
          line: 5,
          column: 1,
          endLine: 5,
          endColumn: 1,
        },
      ],
    },
    {
      name: '#36 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Describes a shape.\n *\n * @property {string} options.name - A path with no root\n */\ninterface Shape {\n  options: { name: string }\n}\n',
      errors: [
        {
          message: '@property path declaration ("options.name") appears before any real property.',
          line: 5,
          column: 1,
          endLine: 5,
          endColumn: 1,
        },
      ],
    },
  ],
})
