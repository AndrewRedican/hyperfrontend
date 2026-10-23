import { testRule } from '../../testing/rule-tester'
import rule from './check-values'

// why: the workspace runs the rule with its default options and settings; the cases with others are left out.
testRule(rule, {
  valid: [
    {
      name: '#7 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @license (MIT OR GPL-2.0)\n       */\n      function quux (foo) {\n\n      }\n      ',
    },
    {
      name: '#15 /**',
      path: '/root/file.ts',
      text: "\n      /**\n       * @module test\n       * @license MIT\r\n       */\n      'use strict';\n      ",
    },
    {
      name: '#20 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * @import LinterDef, { Sth as Something, Another as Another2 } from "eslint"\n         */\n        /**\n         * @import { Linter } from "eslint"\n         */\n        /**\n         * @import LinterDefault from "eslint"\n         */\n        /**\n         * @import {Linter as Lintee} from "eslint"\n         */\n        /**\n         * @import * as Linters from "eslint"\n         */\n      ',
    },
    {
      name: "#21 /** @import { ReactNode } from 'react' */",
      path: '/root/file.ts',
      text: "\n      /** @import { ReactNode } from 'react' */\n\n      /** @type {ReactNode} */\n      export const TEST = null\n      ",
    },
    {
      name: '#22 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Formats a value.\n *\n * @since 1.4.0\n * @version 2.0.0-beta.1\n * @kind function\n * @author Jane Doe\n * @license MIT OR Apache-2.0\n */\nfunction format () {}\n',
    },
    { name: '#23 /**', path: '/root/file.ts', text: '\n/**\n * @since v1.0.0\n */\nfunction format () {}\n' },
  ],
  invalid: [
    {
      name: '#28 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @version 3.1\n       */\n      function quux (foo) {\n\n      }\n      ',
      errors: [{ message: 'Invalid JSDoc @version: "3.1".', line: 3, column: 1, endLine: 3, endColumn: 1 }],
    },
    {
      name: '#30 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @kind -3\n       */\n      function quux (foo) {\n\n      }\n      ',
      errors: [
        {
          message:
            'Invalid JSDoc @kind: "-3"; must be one of: class, constant, event, external, file, function, member, mixin, module, namespace, typedef.',
          line: 3,
          column: 1,
          endLine: 3,
          endColumn: 1,
        },
      ],
    },
    {
      name: '#33 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @since 3.1\n       */\n      function quux (foo) {\n\n      }\n      ',
      errors: [{ message: 'Invalid JSDoc @since: "3.1".', line: 3, column: 1, endLine: 3, endColumn: 1 }],
    },
    {
      name: '#34 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @license\n       */\n      function quux (foo) {\n\n      }\n      ',
      errors: [{ message: 'Missing JSDoc @license value.', line: 3, column: 1, endLine: 3, endColumn: 1 }],
    },
    {
      name: '#38 /**',
      path: '/root/file.ts',
      text: '\n      /**\n       * @license (MIT OR GPL-2.5)\n       */\n      function quux (foo) {\n\n      }\n      ',
      errors: [
        {
          message: 'Invalid JSDoc @license: "(MIT OR GPL-2.5)"; expected SPDX expression: https://spdx.org/licenses/.',
          line: 3,
          column: 1,
          endLine: 3,
          endColumn: 1,
        },
      ],
    },
    {
      name: '#46 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * @import BadImportIgnoredByThisRule\n         */\n        /**\n         * @import {AnotherBadImportIgnoredByThisRule} from\n         */\n      ',
      errors: [
        { message: 'Bad @import tag', line: 3, column: 1, endLine: 3, endColumn: 1 },
        { message: 'Bad @import tag', line: 6, column: 1, endLine: 6, endColumn: 1 },
      ],
    },
    {
      name: '#48 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @since\n * @version\n * @kind\n * @author\n */\nfunction format () {}\n',
      errors: [
        { message: 'Missing JSDoc @since value.', line: 3, column: 1, endLine: 3, endColumn: 1 },
        { message: 'Missing JSDoc @version value.', line: 4, column: 1, endLine: 4, endColumn: 1 },
        { message: 'Missing JSDoc @kind value.', line: 5, column: 1, endLine: 5, endColumn: 1 },
        { message: 'Missing JSDoc @author value.', line: 6, column: 1, endLine: 6, endColumn: 1 },
      ],
    },
  ],
})
