import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createMarkdownWorkspace } from './__fixtures__/markdown-workspace.ts'
import rule from './lib-pkg-description.ts'

const workspace = createMarkdownWorkspace()
const BADGES = '<p align="center">\n  <img src="https://img.shields.io/npm/v/x">\n</p>\n<p align="center">\n  <a href="x">y</a>\n</p>\n'
workspace.write(
  'libs/pub/README.md',
  `# @s/pub\n\n${BADGES}\n![hero](https://x/hero.gif)\n<!-- note -->\n  Composes features into one scene.  \n\n## What is\n`
)
workspace.write(
  'libs/heading/project.json',
  '{ "name": "lib-heading", "projectType": "library", "targets": { "build": {}, "publish": {} } }'
)
workspace.write('libs/heading/README.md', `# @s/heading\n\n${BADGES}\n## What is\n\nProse.\n`)
workspace.write('libs/plain/project.json', '{ "name": "lib-plain", "projectType": "library", "targets": { "build": {}, "publish": {} } }')
workspace.write('libs/plain/README.md', '# @s/plain\n\nNo badges here.\n')
workspace.write(
  'libs/noreadme/project.json',
  '{ "name": "lib-noreadme", "projectType": "library", "targets": { "build": {}, "publish": {} } }'
)
workspace.write('libs/tail/project.json', '{ "name": "lib-tail", "projectType": "library", "targets": { "build": {}, "publish": {} } }')
workspace.write('libs/tail/README.md', `# @s/tail\n\n${BADGES}\n![hero](https://x/hero.gif)\n\n`)
workspace.write(
  'libs/centred/project.json',
  '{ "name": "lib-centred", "projectType": "library", "targets": { "build": {}, "publish": {} } }'
)
workspace.write('libs/centred/README.md', '# @s/centred\n\n<p align="center"><b>no badge</b></p>\n\nThe first centred block counts.\n')
const MANIFEST = workspace.libraryFile('package.json')
const MESSAGE =
  'The manifest description differs from the line the README opens with, which is the sentence the documentation site and the registry both lead with. Run lint with --fix to copy it in.'

testRule(rule, {
  valid: [
    {
      name: 'a description equal to the readme line',
      path: MANIFEST,
      text: '{ "name": "@s/pub", "description": "Composes features into one scene." }',
    },
    {
      name: 'a nested field of the same name',
      path: MANIFEST,
      text: '{ "description": "Composes features into one scene.", "nested": { "description": "other" } }',
    },
    { name: 'a description that is no literal', path: MANIFEST, text: '{ "description": { "text": "x" }, "other": [1] }' },
    {
      name: 'a readme that opens with a heading after its badges',
      path: join(workspace.root, 'libs', 'heading', 'package.json'),
      text: '{ "description": "anything" }',
    },
    {
      name: 'a readme without a centred block',
      path: join(workspace.root, 'libs', 'plain', 'package.json'),
      text: '{ "description": "anything" }',
    },
    {
      name: 'a readme with nothing after its badges',
      path: join(workspace.root, 'libs', 'tail', 'package.json'),
      text: '{ "description": "anything" }',
    },
    {
      name: 'a readme with nothing after its badges',
      path: join(workspace.root, 'libs', 'tail', 'package.json'),
      text: '{ "description": "anything" }',
    },
    {
      name: 'a library without a readme',
      path: join(workspace.root, 'libs', 'noreadme', 'package.json'),
      text: '{ "description": "anything" }',
    },
    { name: 'an internal library', path: workspace.internalFile('package.json'), text: '{ "description": "anything" }' },
    { name: 'a file that is no manifest', path: workspace.libraryFile('other.json'), text: '{ "description": "anything" }' },
  ],
  invalid: [
    {
      name: 'a drifted description, replaced with the readme line',
      path: MANIFEST,
      text: '{\n  "name": "@s/pub",\n  "description": "Old words"\n}\n',
      errors: [{ message: MESSAGE, line: 3, column: 18, endLine: 3, endColumn: 29 }],
      output: '{\n  "name": "@s/pub",\n  "description": "Composes features into one scene."\n}\n',
    },
    {
      name: 'a description that is a number',
      path: MANIFEST,
      text: '{ "description": 1 }',
      errors: [{ message: MESSAGE, line: 1, column: 18, endLine: 1, endColumn: 19 }],
      output: '{ "description": "Composes features into one scene." }',
    },
    {
      name: 'a readme whose first centred block carries no badge',
      path: join(workspace.root, 'libs', 'centred', 'package.json'),
      text: '{ "description": "x" }',
      errors: [{ message: MESSAGE, line: 1, column: 18 }],
      output: '{ "description": "The first centred block counts." }',
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    workspace.remove()
    expect(existsSync(workspace.root)).toBe(false)
  })
})
