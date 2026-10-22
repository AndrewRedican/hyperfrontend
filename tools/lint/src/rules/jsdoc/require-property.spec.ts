import { testRule } from '../../testing/rule-tester.ts'
import rule from './require-property.ts'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#10 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @typedef {object} SomeTypedef\n           * @property someProp\n           * @property anotherProp This with a description\n           * @property {anotherType} yetAnotherProp This with a type and desc.\n           */\n          function quux () {\n\n          }\n      ',
    },
    {
      name: '#11 /**',
      path: '/root/file.ts',
      text: '\n/**\n * A point on the plane.\n */\nexport interface Point {\n  /** The horizontal position. */\n  x: number\n}\n',
    },
  ],
  invalid: [
    {
      name: '#15 class Test {',
      path: '/root/file.ts',
      text: '\n      class Test {\n          /**\n           * @typedef {object} SomeTypedef\n           */\n          quux () {}\n      }\n      ',
      errors: [{ message: 'Missing JSDoc @property.', line: 3, column: 11, endLine: 5, endColumn: 14 }],
      output:
        '\n      class Test {\n          /**\n           * @typedef {object} SomeTypedef\n           * @property\n           */\n          quux () {}\n      }\n      ',
    },
    {
      name: '#18 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @typedef {object} SomeTypedef\n */\nconst value = 1\n',
      errors: [{ message: 'Missing JSDoc @property.', line: 2, column: 1, endLine: 4, endColumn: 4 }],
      output: '\n/**\n * @typedef {object} SomeTypedef\n * @property\n */\nconst value = 1\n',
    },
    {
      name: '#20 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @typedef {object} SomeTypedef\n * @namespace {Object} SomeName\n */\n',
      errors: [
        { message: 'Missing JSDoc @property.', line: 2, column: 1, endLine: 5, endColumn: 4 },
        { message: 'Missing JSDoc @property.', line: 2, column: 1, endLine: 5, endColumn: 4 },
      ],
      output: '\n/**\n * @typedef {object} SomeTypedef\n * @namespace {Object} SomeName\n * @property\n */\n',
    },
  ],
})
