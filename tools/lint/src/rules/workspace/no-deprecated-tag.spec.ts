import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-deprecated-tag.ts'

testRule(rule, {
  valid: [
    {
      name: '#1 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * A useful function.\n       * @param x - The input value.\n       * @returns The output value.\n       */\n      function foo(x: number): number {\n        return x * 2\n      }\n    ',
    },
    {
      name: '#2 // This is deprecated but in a line comment',
      path: '/root/file.ts',
      text: '\n      // This is deprecated but in a line comment\n      function oldFunction() {}\n    ',
    },
    {
      name: '#5 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * Process data.\n       * @param data - Input data.\n       * @throws Error if data is invalid.\n       * @example\n       * processData({ value: 1 })\n       */\n      function processData(data: object): void {}\n    ',
    },
    {
      name: '#6 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * A sample class.\n       */\n      class MyClass {\n        /**\n         * Constructor.\n         */\n        constructor() {}\n      }\n    ',
    },
    {
      name: '#7 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * Configuration interface.\n       */\n      interface Config {\n        value: string\n      }\n    ',
    },
  ],
  invalid: [
    {
      name: '#14 /** @deprecated */',
      path: '/root/file.ts',
      text: '/** @deprecated */\nconst x = 1',
      errors: [
        {
          message:
            'The deprecated tag is not allowed. This project handles breaking changes through semantic versioning and does not support backwards compatibility. Remove deprecated code in the next major version instead.',
          line: 1,
          column: 5,
          endLine: 1,
          endColumn: 16,
        },
      ],
    },
    {
      name: '#16 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @deprecated Use NewType.\n       */\n      type OldType = string | number\n    ',
      errors: [
        {
          message:
            'The deprecated tag is not allowed. This project handles breaking changes through semantic versioning and does not support backwards compatibility. Remove deprecated code in the next major version instead.',
          line: 3,
          column: 10,
          endLine: 3,
          endColumn: 21,
        },
      ],
    },
    {
      name: '#18 class MyClass {',
      path: '/root/file.ts',
      text: '\n      class MyClass {\n        /**\n         * @deprecated Use newMethod instead.\n         */\n        oldMethod() {}\n      }\n    ',
      errors: [
        {
          message:
            'The deprecated tag is not allowed. This project handles breaking changes through semantic versioning and does not support backwards compatibility. Remove deprecated code in the next major version instead.',
          line: 4,
          column: 12,
          endLine: 4,
          endColumn: 23,
        },
      ],
    },
  ],
})

const MESSAGE =
  'The deprecated tag is not allowed. This project handles breaking changes through semantic versioning and does not support backwards compatibility. Remove deprecated code in the next major version instead.'

testRule(rule, {
  valid: [{ name: 'the tag named in inline code', path: '/root/file.ts', text: '/** Upstream `@deprecated` notes are kept. */\n' }],
  invalid: [
    {
      name: 'a plain block comment, its first tag only',
      path: '/root/file.ts',
      text: '/* @deprecated once\n * @deprecated twice */\n',
      errors: [{ message: MESSAGE, line: 1, column: 4, endLine: 1, endColumn: 15 }],
    },
    {
      name: 'a tag closing the block',
      path: '/root/file.ts',
      text: '/** see @deprecated*/\n',
      errors: [{ message: MESSAGE, line: 1, column: 9, endLine: 1, endColumn: 20 }],
    },
  ],
})
