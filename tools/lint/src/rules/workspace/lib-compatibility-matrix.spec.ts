import { existsSync } from 'node:fs'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { buildCompatibilityDocument } from '@hyperfrontend/workspace'
import { createMarkdownWorkspace } from './__fixtures__/markdown-workspace.ts'
import rule from './lib-compatibility-matrix.ts'

const workspace = createMarkdownWorkspace()
workspace.write('package.json', '{ "name": "root" }')
workspace.write(
  'libs/pub/project.json',
  '{ "name": "lib-pub", "projectType": "library", "targets": { "build": {}, "publish": {} }, "metadata": { "compatibility": { "environments": { "node": "full", "browser": "partial", "webWorker": "none" } } } }'
)
workspace.write('libs/pub/package.json', '{ "name": "@s/pub", "description": "Composes.", "engines": { "node": ">=18.0.0" } }')
const DOCUMENT = workspace.rootFile('LIBRARY_COMPATIBILITY.md')
const EXPECTED = buildCompatibilityDocument(workspace.root)
const MESSAGE =
  'LIBRARY_COMPATIBILITY.md is generated from each package project.json and package.json, and no longer matches them. Run `npx nx lint:all` (or `nx lint @hyperfrontend/workspace --fix`) to regenerate it.'

testRule(rule, {
  valid: [
    { name: 'a document equal to the generated one', path: DOCUMENT, text: EXPECTED },
    { name: 'a document of another name', path: workspace.rootFile('COMPATIBILITY.md'), text: '# Stale\n' },
    { name: 'a document outside the root', path: workspace.libraryFile('LIBRARY_COMPATIBILITY.md'), text: '# Stale\n' },
  ],
  invalid: [
    {
      name: 'a stale document, rewritten in full',
      path: DOCUMENT,
      text: '# Stale\n\nOld rows.\n',
      errors: [{ message: MESSAGE, line: 1, column: 1, endLine: 4, endColumn: 1 }],
      output: EXPECTED,
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    workspace.remove()
    expect(existsSync(workspace.root)).toBe(false)
  })
})
