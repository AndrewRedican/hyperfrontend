import { testRule } from '../../testing/rule-tester.ts'
import rule from './require-description.ts'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    { name: '#1 /**', path: '/root/file.ts', text: '\n          /**\n           *\n           */\n      ' },
    {
      name: '#30 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Returns its argument unchanged.\n *\n * @param value - The value\n * @returns The value\n */\nexport function identity(value: number): number {\n  return value\n}\n',
    },
    { name: '#32 /**', path: '/root/file.ts', text: '\n/**\n * @override\n */\nfunction quux () {}\n' },
  ],
  invalid: [
    {
      name: '#50 class TestClass {',
      path: '/root/file.ts',
      text: '\n        class TestClass {\n          /**\n           *\n           */\n          constructor() { }\n        }\n        ',
      errors: [{ message: 'Missing JSDoc block description.', line: 3, column: 11, endLine: 5, endColumn: 14 }],
    },
    {
      name: '#52 class TestClass {',
      path: '/root/file.ts',
      text: '\n      class TestClass {\n        /**\n         *\n         */\n        get Test() { }\n      }\n      ',
      errors: [{ message: 'Missing JSDoc block description.', line: 3, column: 9, endLine: 5, endColumn: 12 }],
    },
    {
      name: '#54 class TestClass {',
      path: '/root/file.ts',
      text: '\n      class TestClass {\n        /**\n         *\n         */\n        set Test(value) { }\n      }\n      ',
      errors: [{ message: 'Missing JSDoc block description.', line: 3, column: 9, endLine: 5, endColumn: 12 }],
    },
    {
      name: '#63 app.use(',
      path: '/root/file.ts',
      text: '\n        app.use(\n          /** @type {express.ErrorRequestHandler} */\n          (\n            (err, req, res, next) => {\n              // foo\n            }\n          )\n        );\n      ',
      errors: [{ message: 'Missing JSDoc block description.', line: 3, column: 11, endLine: 3, endColumn: 53 }],
    },
    {
      name: '#66 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @param value - The value\n */\nexport declare function add(value: number): void\n',
      errors: [{ message: 'Missing JSDoc block description.', line: 2, column: 1, endLine: 4, endColumn: 4 }],
    },
    {
      name: '#67 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @desc Adds.\n */\nconst add = () => {}\n',
      errors: [
        {
          message: 'Remove the @desc tag to leave a plain block description or add additional description text above the @desc line.',
          line: 2,
          column: 1,
          endLine: 4,
          endColumn: 4,
        },
      ],
    },
  ],
})
