import { testRule } from '../../testing/rule-tester.ts'
import rule from './escape-inline-tags.ts'

// why: the workspace runs the rule with its allowed package scopes and no fixer; the cases with other options or settings are left out.
testRule(rule, {
  valid: [
    {
      name: '#4 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * @param {SomeType} aName A description with an escaped \\@tag.\n         */\n      ',
    },
    {
      name: '#9 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * @someTag {@link https://example.com}\n         */\n      ',
    },
    {
      name: '#12 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * @example\n         * Here are some unescaped tags: @yearly, @monthly\n         */\n      ',
    },
    {
      name: '#14 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Installs @hyperfrontend/features beside @nx/devkit.\n *\n * @param name - A package such as @hyperfrontend/logging\n */\nfunction install (name) {}\n',
      options: { allowedInlineTags: ['hyperfrontend', 'nx'] },
    },
  ],
  invalid: [
    {
      name: '#24 /**',
      path: '/root/file.ts',
      text: '\n        /**\n         * Some description @sth\n         */\n      ',
      options: { enableFixer: false },
      errors: [
        {
          message: 'Unexpected inline JSDoc tag. Did you mean to use {@sth}, \\@sth, or `@sth`?',
          line: 3,
          column: 1,
          endLine: 3,
          endColumn: 1,
        },
      ],
    },
    {
      name: '#30 /**',
      path: '/root/file.ts',
      text: '\n/**\n * Formats a value.\n * Prefer this over the @deprecated one.\n */\nfunction format () {}\n',
      options: { allowedInlineTags: ['hyperfrontend', 'nx'] },
      errors: [
        {
          message: 'Unexpected inline JSDoc tag. Did you mean to use {@deprecated}, \\@deprecated, or `@deprecated`?',
          line: 4,
          column: 1,
          endLine: 4,
          endColumn: 1,
        },
      ],
    },
    {
      name: '#31 /**',
      path: '/root/file.ts',
      text: '\n/**\n * @param name - Not a package scope: @angular/core\n */\nfunction install (name) {}\n',
      options: { allowedInlineTags: ['hyperfrontend', 'nx'] },
      errors: [
        {
          message: 'Unexpected inline JSDoc tag. Did you mean to use {@angular}, \\@angular, or `@angular`?',
          line: 3,
          column: 1,
          endLine: 3,
          endColumn: 1,
        },
      ],
    },
  ],
})

testRule(rule, {
  valid: [],
  invalid: [
    {
      name: 'a tag on the opening line naming one scope twice',
      path: '/root/file.ts',
      text: '/** @param a - Uses @foo and @foo */',
      errors: [
        {
          message: 'Unexpected inline JSDoc tag. Did you mean to use {@foo}, \\@foo, or `@foo`?',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 1,
        },
      ],
    },
  ],
})
