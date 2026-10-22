import { testRule } from '../../testing/rule-tester.ts'
import rule from './require-property-name.ts'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#1 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @typedef {SomeType} SomeTypedef\n           * @property foo\n           */\n      ',
    },
    {
      name: '#5 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @typedef {object} Options\n * @property {string} name - The display name\n * @property {number} [size=10] - The size in pixels\n */\n',
    },
  ],
  invalid: [
    {
      name: '#10 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @interface Options\n * @property\n * @property {string}\n */\n',
      errors: [
        { message: 'There must be an identifier after @property type.', line: 4, column: 1, endLine: 4, endColumn: 1 },
        { message: 'There must be an identifier after @property tag.', line: 5, column: 1, endLine: 5, endColumn: 1 },
      ],
    },
  ],
})
