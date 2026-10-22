import { testRule } from '../../testing/rule-tester.ts'
import rule from './require-property-description.ts'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#5 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * Typedef with multi-line property type.\n       *\n       * @typedef {object} MyType\n       * @property {function(\n       *   number\n       * )} numberEater Method which takes a number.\n       */\n      ',
    },
    {
      name: '#6 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @typedef {object} Options\n * @property {string} name - The display name\n * @property {number} [size] - The size in pixels\n */\n',
    },
  ],
  invalid: [
    {
      name: '#12 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @typedef {object} Options\n * @property\n * @property {string}\n */\n',
      errors: [
        { message: 'Missing JSDoc @property "" description.', line: 4, column: 1, endLine: 4, endColumn: 1 },
        { message: 'Missing JSDoc @property "" description.', line: 5, column: 1, endLine: 5, endColumn: 1 },
      ],
    },
  ],
})
