import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { testRule } from '../../testing/rule-tester.ts'
import { createLibraryWorkspace } from './__fixtures__/library-workspace.ts'
import rule from './lib-require-module-header.ts'

const workspace = createLibraryWorkspace()

// why: the cases were recorded in temporary libraries; each is linted in the fixture library its recorded setup describes.
testRule(rule, {
  valid: [
    { name: '#1 ignores non-index.ts files', path: '/some/path/exports.ts', text: "export * from './foo'" },
    {
      name: '#2 ignores non-publishable libraries',
      path: join(workspace.root, 'internal', 'src', 'index.ts'),
      text: "export * from './foo'",
    },
    {
      name: '#4 ignores projects without package.json',
      path: join(workspace.root, 'nopkg', 'src', 'index.ts'),
      text: "export * from './foo'",
    },
    {
      name: '#15 allows @module followed by carriage return',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: "/**\r\n * Fixture helpers for exercising the rule tester.\r\n *\r\n * @module\r\n */\r\nexport * from './foo'",
    },
    {
      name: '#16 allows a long description when the ceiling is raised',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: "/**\n * Fixture helpers for exercising the rule tester across every branch it has. Fixture helpers for exercising the rule tester across every branch it has. Fixture helpers for exercising the rule tester across every branch it has. \n *\n * @module @hyperfrontend/test-lib\n */\nexport * from './foo'",
      options: { maxDescriptionLength: 400 },
    },
  ],
  invalid: [
    {
      name: '#18 reports entry point missing @module header',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: "export * from './foo'\nexport * from './bar'",
      errors: [
        {
          message:
            'Entry point files in publishable libraries must have a @module header comment at the top of the file. Add a JSDoc comment with @module tag followed by the package path.',
          line: 1,
          column: 1,
          endLine: null,
          endColumn: null,
        },
      ],
    },
    {
      name: '#19 reports JSDoc comment without @module tag',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: "/**\n * This is a description without module tag.\n */\nexport * from './foo'",
      errors: [
        {
          message:
            'Entry point files in publishable libraries must have a @module header comment at the top of the file. Add a JSDoc comment with @module tag followed by the package path.',
          line: 1,
          column: 1,
          endLine: 3,
          endColumn: 4,
        },
      ],
    },
    {
      name: '#20 reports line comment instead of JSDoc',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: "// @module @hyperfrontend/test-lib\nexport * from './foo'",
      errors: [
        {
          message:
            'Entry point files in publishable libraries must have a @module header comment at the top of the file. Add a JSDoc comment with @module tag followed by the package path.',
          line: 1,
          column: 1,
          endLine: null,
          endColumn: null,
        },
      ],
    },
    {
      name: '#25 reports a @module header with no description',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: "/**\n * @module @hyperfrontend/test-lib\n */\nexport * from './foo'",
      errors: [
        {
          message:
            'The @module header must open with a description before its tags. Say in one or two sentences what capability this module exposes.',
          line: 1,
          column: 1,
          endLine: 3,
          endColumn: 4,
        },
      ],
    },
    {
      name: '#26 reports a description longer than the ceiling',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: "/**\n * Fixture helpers for exercising the rule tester across every branch it has. Fixture helpers for exercising the rule tester across every branch it has. Fixture helpers for exercising the rule tester across every branch it has. Fixture helpers for exercising the rule tester across every branch it has. \n *\n * @module @hyperfrontend/test-lib\n */\nexport * from './foo'",
      errors: [
        {
          message:
            'The @module description is 299 characters; keep it to 200. It names what the module is responsible for, not how it works: move the walkthrough to the README or to the symbols it belongs to.',
          line: 1,
          column: 1,
          endLine: 5,
          endColumn: 4,
        },
      ],
    },
    {
      name: '#27 reports a description shorter than the floor',
      path: join(workspace.root, 'pub', 'src', 'index.ts'),
      text: "/**\n * Parses ranges.\n *\n * @module @hyperfrontend/test-lib\n */\nexport * from './foo'",
      errors: [
        {
          message: 'The @module description is 14 characters; give it at least 24. Say what capability this module exposes.',
          line: 1,
          column: 1,
          endLine: 5,
          endColumn: 4,
        },
      ],
    },
    {
      name: '#28 reports a description that only restates the module path',
      path: join(workspace.root, 'pub', 'src', 'nx', 'executors', 'serve', 'index.ts'),
      text: "/**\n * Nx `serve` executor entry point.\n *\n * @module @hyperfrontend/test-lib/nx/executors/serve\n */\nexport * from './serve'",
      errors: [
        {
          message:
            'The @module description adds nothing to the module path. Say what capability "@hyperfrontend/test-lib/nx/executors/serve" exposes instead of restating its name.',
          line: 1,
          column: 1,
          endLine: 5,
          endColumn: 4,
        },
      ],
    },
  ],
})

// why: the cases recorded from the previous linter leave a manifest without exports and a tag without a module path unexercised.
testRule(rule, {
  valid: [
    {
      name: 'a main entry of a library without exports, its tag naming no path',
      path: join(workspace.plain, 'src', 'index.ts'),
      text: '/**\n * Parses and formats calendar dates for every supported locale.\n *\n * @module\n */\nexport {}',
    },
    {
      name: 'a description whose plural words count once their endings are dropped',
      path: join(workspace.root, 'pub', 'src', 'nx', 'executors', 'serve', 'index.ts'),
      text: "/**\n * Runs queries over boxes of serve executor settings.\n *\n * @module @hyperfrontend/test-lib/nx/executors/serve\n */\nexport * from './serve'",
    },
  ],
  invalid: [],
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(workspace.root, { recursive: true, force: true })
    expect(existsSync(workspace.root)).toBe(false)
  })
})
