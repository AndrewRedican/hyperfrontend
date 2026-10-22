import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-defaults.ts'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#1 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @param foo\n           */\n          function quux (foo) {\n\n          }\n      ',
    },
    {
      name: '#4 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           * @function\n           * @param {number} foo\n           */\n      ',
    },
    {
      name: '#8 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @param [value] - Optional, without a default\n * @default\n */\nfunction quux (value = 1) {}\n',
    },
    {
      name: '#9 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @param [value=1] - Not a function block under the default contexts\n */\nconst value = 1\n',
    },
  ],
  invalid: [
    {
      name: '#11 class Test {',
      path: '/root/file.ts',
      text: '\n      class Test {\n          /**\n           * @param {number} [foo="7"]\n           */\n          quux (foo) {\n\n          }\n      }\n      ',
      errors: [{ message: 'Defaults are not permitted on @param.', line: 4, column: 1, endLine: 4, endColumn: 1 }],
      output:
        '\n      class Test {\n          /**\n           * @param {number} [foo]\n           */\n          quux (foo) {\n\n          }\n      }\n      ',
    },
    {
      name: '#19 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Formats a value.\n *\n * @param [radix=10] - The radix\n */\nfunction format (radix = 10) {}\n',
      errors: [{ message: 'Defaults are not permitted on @param.', line: 5, column: 1, endLine: 5, endColumn: 1 }],
      output: '\n/**\n * Formats a value.\n *\n * @param [radix] - The radix\n */\nfunction format (radix = 10) {}\n',
    },
    {
      name: '#21 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @defaultvalue 5\n */\nfunction quux () {}\n',
      errors: [{ message: 'Default values are not permitted on @defaultvalue.', line: 3, column: 1, endLine: 3, endColumn: 1 }],
      output: '\n/**\n * @defaultvalue\n */\nfunction quux () {}\n',
    },
  ],
})
