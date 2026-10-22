import { testRule } from '../../testing/rule-tester.ts'
import rule from './ts-no-empty-object-type.ts'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#2 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * @param {({a: string} & {b: number})} someName\n         */\n      ',
    },
    { name: '#3 /**', path: '/root/file.ts', text: '\n        /**\n         * @param {BadType<} someName\n         */\n      ' },
    {
      name: '#5 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Reads options.\n *\n * @param options - The options, untyped in TypeScript style\n * @returns The keys\n */\nexport function keys(options: Record<string, unknown>): string[] {\n  return Object.keys(options)\n}\n',
    },
  ],
  invalid: [
    {
      name: '#11 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Makes a value.\n *\n * @returns {Promise<{}>} The value\n */\nexport function make(): Promise<object> {\n  return Promise.resolve({})\n}\n',
      errors: [{ message: 'No empty object type.', line: 5, column: 1, endLine: 5, endColumn: 1 }],
    },
    {
      name: '#12 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @type {{}|{}}\n */\nlet value\n',
      errors: [
        { message: 'No empty object type.', line: 3, column: 1, endLine: 3, endColumn: 1 },
        { message: 'No empty object type.', line: 3, column: 1, endLine: 3, endColumn: 1 },
      ],
    },
  ],
})
