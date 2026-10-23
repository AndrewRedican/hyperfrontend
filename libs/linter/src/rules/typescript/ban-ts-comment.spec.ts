import { testRule } from '../../testing/rule-tester'
import rule from './ban-ts-comment'

// why: the rule is fixed to the workspace's options; the cases recorded with other directive settings, description lengths or formats are left out.
testRule(rule, {
  valid: [
    {
      name: '#99 const a = 1;',
      path: '/root/file.ts',
      text: '\nconst a = 1;\n\n// @ts-nocheck - should not be reported\n\n// TS error is not actually suppressed\nconst b: string = a;\n    ',
    },
  ],
  invalid: [
    {
      name: '#30 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @ts-expect-error 👨‍👩‍👧‍👦 */\n      ',
      options: { 'ts-expect-error': 'allow-with-description' },
      errors: [
        {
          message:
            'Include a description after the "@ts-expect-error" directive to explain why the @ts-expect-error is necessary. The description must be 3 characters or longer.',
          line: 2,
          column: 1,
          endLine: 3,
          endColumn: 35,
        },
      ],
    },
    {
      name: '#45 every directive comment of a file is reported',
      path: '/root/file.ts',
      text: '\n// @ts-expect-error\nconst a = 1;\n// @ts-expect-error\nconst b = 2;\n    ',
      errors: [
        {
          message:
            'Include a description after the "@ts-expect-error" directive to explain why the @ts-expect-error is necessary. The description must be 3 characters or longer.',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 20,
        },
        {
          message:
            'Include a description after the "@ts-expect-error" directive to explain why the @ts-expect-error is necessary. The description must be 3 characters or longer.',
          line: 4,
          column: 1,
          endLine: 4,
          endColumn: 20,
        },
      ],
    },
    {
      name: '#76 if (false) {',
      path: '/root/file.ts',
      text: "\nif (false) {\n  // @ts-ignore: Unreachable code error\n  console.log('hello');\n}\n      ",
      errors: [
        {
          message: 'Use "@ts-expect-error" instead of "@ts-ignore", as "@ts-ignore" will do nothing if the following line is error-free.',
          line: 3,
          column: 3,
          endLine: 3,
          endColumn: 40,
        },
      ],
    },
    {
      name: '#110 // @ts-nocheck',
      path: '/root/file.ts',
      text: '\n // @ts-nocheck\nconst a: true = false;\n      ',
      errors: [
        { message: 'Do not use "@ts-nocheck" because it alters compilation errors.', line: 2, column: 2, endLine: 2, endColumn: 16 },
      ],
    },
  ],
})
