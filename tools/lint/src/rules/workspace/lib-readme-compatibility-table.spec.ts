import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createMarkdownWorkspace } from './__test-utils__/markdown-workspace.ts'
import rule from './lib-readme-compatibility-table.ts'

const workspace = createMarkdownWorkspace()
workspace.write(
  'libs/compat/project.json',
  '{ "name": "lib-compat", "projectType": "library", "targets": { "build": {}, "publish": {} }, "metadata": { "compatibility": { "environments": { "node": "full", "browser": "partial", "webWorker": "none" } } } }'
)
workspace.write('libs/compat/package.json', '{ "name": "@s/compat", "engines": { "node": ">=18.0.0" } }')
workspace.write(
  'libs/bare/project.json',
  '{ "name": "lib-bare", "projectType": "library", "targets": { "build": {}, "publish": {} }, "metadata": { "compatibility": { "environments": [] } } }'
)
workspace.write(
  'libs/odd/project.json',
  '{ "name": "lib-odd", "projectType": "library", "targets": { "build": {}, "publish": {} }, "metadata": { "compatibility": { "environments": { "node": "mystery", "browser": 1 } } } }'
)
workspace.write('libs/odd/package.json', '{ "name": "@s/odd", "engines": { "node": "18" } }')
const README = join(workspace.root, 'libs', 'compat', 'README.md')

const MISSING_TABLE =
  'The Compatibility section carries no table. Add the runtime table, which is checked against metadata.compatibility in project.json.'
const TABLE_DRIFT =
  'The compatibility table does not match metadata.compatibility in project.json and engines.node in package.json. Run lint with --fix to regenerate it.'

const EXPECTED = [
  '| Environment     | Supported |',
  '| --------------- | :-------: |',
  '| Node.js >= 18   |    ✅     |',
  '| Modern Browsers |    ⚠️     |',
  '| Web Workers     |    ❌     |',
]
const NOWHERE = [
  '| Environment     | Supported |',
  '| --------------- | :-------: |',
  '| Node.js         |    ❌     |',
  '| Modern Browsers |    ❌     |',
  '| Web Workers     |    ❌     |',
]

// why: a readme whose Compatibility section holds the given lines, the section opening on line 5.
const readme = (lines: readonly string[], tail = '\n\n## Next\n\nMore.\n'): string =>
  `# @s/compat\n\nIntro.\n\n## Compatibility\n\n${lines.join('\n')}${tail}`

testRule(rule, {
  valid: [
    { name: 'a table that says what the declaration says', path: README, text: readme(EXPECTED) },
    {
      name: 'a table padded differently, with another delimiter row',
      path: README,
      text: readme(['|Environment|Supported|', '|---|---|', '| Node.js >= 18 | ✅ |', '|Modern Browsers|⚠️|', '| Web Workers |❌|']),
    },
    { name: 'a readme with no Compatibility section', path: README, text: '# @s/compat\n\nIntro.\n' },
    { name: 'a markdown file that is no readme', path: join(workspace.root, 'libs', 'compat', 'ARCHITECTURE.md'), text: readme(NOWHERE) },
    { name: 'a readme outside a publishable library', path: workspace.internalFile('README.md'), text: readme(NOWHERE) },
  ],
  invalid: [
    {
      name: 'a section with no table, reported on its heading',
      path: README,
      text: readme(['Prose only.']),
      errors: [{ message: MISSING_TABLE, line: 5, column: 0, endLine: 5, endColumn: 16 }],
    },
    {
      name: 'a drifted table, replaced with the declared one',
      path: README,
      text: readme(NOWHERE),
      errors: [{ message: TABLE_DRIFT, line: 7, column: 0, endLine: 11, endColumn: 30 }],
      output: readme(EXPECTED),
    },
    {
      name: 'a drifted table in a readme with carriage returns, which keeps its line endings',
      path: README,
      text: readme(NOWHERE).replace(/\n/g, '\r\n'),
      errors: [{ message: TABLE_DRIFT, line: 7, column: 0 }],
      output: readme(EXPECTED).replace(/\n/g, '\r\n'),
    },
    {
      name: 'a table with a row too few, running to the end of the file',
      path: README,
      text: readme(EXPECTED.slice(0, 4), '\n'),
      errors: [{ message: TABLE_DRIFT, line: 7, column: 0, endLine: 10, endColumn: EXPECTED[3].length }],
      output: readme(EXPECTED, '\n'),
    },
    {
      name: 'a declaration that is no object, read as running nowhere, with no manifest for a floor',
      path: join(workspace.root, 'libs', 'bare', 'README.md'),
      text: readme(EXPECTED),
      errors: [{ message: TABLE_DRIFT, line: 7, column: 0 }],
      output: readme(NOWHERE),
    },
    {
      name: 'unknown levels read as none, and a range without a floor',
      path: join(workspace.root, 'libs', 'odd', 'README.md'),
      text: readme(EXPECTED),
      errors: [{ message: TABLE_DRIFT, line: 7, column: 0 }],
      output: readme(NOWHERE),
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    workspace.remove()
    expect(existsSync(workspace.root)).toBe(false)
  })
})
