import { testRule } from '../../testing/rule-tester.ts'
import rule from './check-access.ts'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#1 /**',
      path: '/root/file.ts',
      text: '\n          /**\n           *\n           */\n          function quux (foo) {\n\n          }\n      ',
    },
    {
      name: '#7 (function(exports, require, module, __filename, __dirname) {',
      path: '/root/file.ts',
      text: '\n      (function(exports, require, module, __filename, __dirname) {\n      // Module code actually lives in here\n      });\n      ',
    },
    { name: '#9 /** @access package */', path: '/root/file.ts', text: '\n/** @access package */\nconst value = 1\n' },
  ],
  invalid: [
    {
      name: '#16 class MyClass {',
      path: '/root/file.ts',
      text: '\n      class MyClass {\n        /**\n         * @access\n         */\n        myClassField = 1\n      }\n      ',
      errors: [{ message: 'Missing valid JSDoc @access level.', line: 4, column: 1, endLine: 4, endColumn: 1 }],
    },
    {
      name: '#25 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @access public\n * @private\n * @protected\n */\nfunction quux () {}\n',
      errors: [
        {
          message: 'The @access tag may not be used with specific access-control tags (@package, @private, @protected, or @public).',
          line: 2,
          column: 1,
          endLine: 6,
          endColumn: 4,
        },
        { message: 'At most one access-control tag may be present on a JSDoc block.', line: 2, column: 1, endLine: 6, endColumn: 4 },
      ],
    },
  ],
})
