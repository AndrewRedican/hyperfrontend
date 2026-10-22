import { testRule } from '../../testing/rule-tester.ts'
import rule from './reject-function-type.ts'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#2 // To avoid referencing a generic Function, define a callbac…',
      path: '/root/file.ts',
      text: '\n        // To avoid referencing a generic Function, define a callback\n        //   with its inputs/outputs and a name.\n        /**\n         * @callback          FOOBAR\n         * @param    {number} baz\n         * @return   {number}\n         */\n\n\n        // Then reference the callback name as the type.\n        /**\n         * @param {FOOBAR} fooBar\n         */\n        function quux (fooBar) {\n          console.log(fooBar(3));\n        }\n\n        /**\n         * @param {string|Array<FOOBAR>} abc\n         */\n        function buzz (abc) {}\n      ',
    },
    {
      name: '#3 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @param callback - Called once per item\n */\nexport function each(callback: (item: number) => void): void {}\n',
    },
    {
      name: '#4 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @param {function(number): void} callback\n * @param {Functions} other\n */\nfunction quux (callback, other) {}\n',
    },
  ],
  invalid: [
    {
      name: '#8 /** @type {Record<string, Function>} */',
      path: '/root/file.ts',
      text: '\n/** @type {Record<string, Function>} */\nconst handlers = {}\n',
      errors: [{ message: 'Prefer a more specific type to `Function`', line: 2, column: 1, endLine: 2, endColumn: 1 }],
    },
  ],
})
