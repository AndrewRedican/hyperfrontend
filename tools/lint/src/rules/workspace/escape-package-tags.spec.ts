import { testRule } from '../../testing/rule-tester.ts'
import rule from './escape-package-tags.ts'

// why: the cases with a prefix list exercise the option the workspace configures, so every recorded case is kept.
testRule(rule, {
  valid: [
    {
      name: '#2 accepts a reference as the value of a block tag',
      path: '/root/file.ts',
      text: '/**\n * The broker.\n *\n * @module @hyperfrontend/nexus\n */\nexport const a = 1',
    },
    { name: '#5 ignores line comments', path: '/root/file.ts', text: '// why: @hyperfrontend/nexus is fine here\nexport const a = 1' },
    { name: '#6 ignores non-JSDoc block comments', path: '/root/file.ts', text: '/* @hyperfrontend/nexus */\nexport const a = 1' },
    {
      name: '#7 ignores a scope that is not configured',
      path: '/root/file.ts',
      text: '/**\n * Wraps @nx/devkit here.\n */\nexport const a = 1',
      options: { prefixes: ['@hyperfrontend'] },
    },
  ],
  invalid: [
    {
      name: '#9 replaces a backslash escape with backticks',
      path: '/root/file.ts',
      text: '/**\n * Entry point for the \\@hyperfrontend/package Nx plugin.\n */\nexport const a = 1',
      errors: [
        {
          message:
            'Wrap `@hyperfrontend/package` in backticks. Left bare it is parsed as a JSDoc tag, and a backslash escape leaks into the rendered docs.',
          line: 2,
          column: 24,
          endLine: 2,
          endColumn: 47,
        },
      ],
      output: '/**\n * Entry point for the `@hyperfrontend/package` Nx plugin.\n */\nexport const a = 1',
    },
    {
      name: '#14 wraps every reference on a line',
      path: '/root/file.ts',
      text: '/**\n * Bridges @hyperfrontend/nexus and @hyperfrontend/features.\n */\nexport const a = 1',
      errors: [
        {
          message:
            'Wrap `@hyperfrontend/nexus` in backticks. Left bare it is parsed as a JSDoc tag, and a backslash escape leaks into the rendered docs.',
          line: 2,
          column: 12,
          endLine: 2,
          endColumn: 32,
        },
        {
          message:
            'Wrap `@hyperfrontend/features` in backticks. Left bare it is parsed as a JSDoc tag, and a backslash escape leaks into the rendered docs.',
          line: 2,
          column: 37,
          endLine: 2,
          endColumn: 60,
        },
      ],
      output: '/**\n * Bridges `@hyperfrontend/nexus` and `@hyperfrontend/features`.\n */\nexport const a = 1',
    },
  ],
})

const MESSAGE = (specifier: string): string =>
  `Wrap \`${specifier}\` in backticks. Left bare it is parsed as a JSDoc tag, and a backslash escape leaks into the rendered docs.`

testRule(rule, {
  valid: [
    {
      name: 'a prefix that only starts a longer word',
      path: '/w/a.ts',
      text: '/**\n * Not @hyperfrontendish at all.\n */\nexport const a = 1\n',
    },
    {
      name: 'a reference inside a fenced description block',
      path: '/w/a.ts',
      text: '/**\n * Run:\n * ```\n * nx add @hyperfrontend/x\n * ```\n */\nexport const a = 1\n',
    },
    {
      name: 'a backslash before something other than a scope',
      path: '/w/a.ts',
      text: '/**\n * A \\n and @other/x here.\n */\nexport const a = 1\n',
    },
    { name: 'a one-line block without a closing line break', path: '/w/a.ts', text: '/** plain */\nexport const a = 1\n' },
  ],
  invalid: [
    {
      name: 'a reference on a CRLF line, punctuation trimmed',
      path: '/w/a.ts',
      text: '/**\r\n * Uses @hyperfrontend/a/.\r\n */\r\nexport const a = 1\r\n',
      errors: [{ message: MESSAGE('@hyperfrontend/a'), line: 2, column: 9, endLine: 2, endColumn: 25 }],
      output: '/**\r\n * Uses `@hyperfrontend/a`/.\r\n */\r\nexport const a = 1\r\n',
    },
    {
      name: 'a specifier with an underscore, a trailing colon trimmed',
      path: '/w/a.ts',
      text: '/**\n * Uses @hyperfrontend/a_b:\n */\nexport const a = 1\n',
      errors: [{ message: MESSAGE('@hyperfrontend/a_b'), line: 2, column: 9, endLine: 2, endColumn: 27 }],
      output: '/**\n * Uses `@hyperfrontend/a_b`:\n */\nexport const a = 1\n',
    },
    {
      name: 'a reference ending the comment on its first line',
      path: '/w/a.ts',
      text: '/** @hyperfrontend/a */\nexport const a = 1\n',
      errors: [{ message: MESSAGE('@hyperfrontend/a'), line: 1, column: 5, endLine: 1, endColumn: 21 }],
      output: '/** `@hyperfrontend/a` */\nexport const a = 1\n',
    },
  ],
})
