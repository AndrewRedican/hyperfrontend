import { existsSync } from 'node:fs'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createProjectTrees } from './__test-utils__/project-trees.ts'
import rule from './lib-pkg-exports-js-only.ts'

const projects = createProjectTrees()
const PUBLISHABLE = projects.file('publishable', 'package.json')

testRule(rule, {
  valid: [
    {
      name: 'compiled extensions',
      path: PUBLISHABLE,
      text: '{ "exports": { ".": "./src/index.js", "./a": "./a.mjs", "./b": "./b.cjs", "./package.json": "./package.json" } }',
    },
    { name: 'a bare specifier', path: PUBLISHABLE, text: '{ "exports": { ".": "some-package" } }' },
    { name: 'no exports', path: PUBLISHABLE, text: '{}' },
  ],
  invalid: [
    {
      name: 'a TypeScript source, fixed to .js',
      path: PUBLISHABLE,
      text: '{ "exports": { ".": "./src/index.ts" } }',
      errors: [
        {
          message:
            "Export path './src/index.ts' has invalid extension '.ts'. Use './src/index.js' instead. Package.json exports should reference compiled .js files, not source files.",
          line: 1,
          column: 21,
          endLine: 1,
          endColumn: 37,
        },
      ],
      output: '{ "exports": { ".": "./src/index.js" } }',
    },
    {
      name: 'nested conditions with .mts and .cts sources',
      path: PUBLISHABLE,
      text: '{ "exports": { ".": { "import": "./a.mts", "require": "./a.cts" } } }',
      errors: [
        {
          message:
            "Export path './a.mts' has invalid extension '.mts'. Use './a.mjs' instead. Package.json exports should reference compiled .js files, not source files.",
          line: 1,
          column: 33,
        },
        {
          message:
            "Export path './a.cts' has invalid extension '.cts'. Use './a.cjs' instead. Package.json exports should reference compiled .js files, not source files.",
          line: 1,
          column: 55,
        },
      ],
      output: '{ "exports": { ".": { "import": "./a.mjs", "require": "./a.cjs" } } }',
    },
    {
      name: 'a path without an extension',
      path: PUBLISHABLE,
      text: '{ "exports": { ".": "./src/index" } }',
      errors: [
        {
          message:
            "Export path './src/index' has invalid extension ''. Use './src/index.js' instead. Package.json exports should reference compiled .js files, not source files.",
          line: 1,
          column: 21,
        },
      ],
      output: '{ "exports": { ".": "./src/index.js" } }',
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    projects.remove()
    expect(existsSync(projects.root)).toBe(false)
  })
})
