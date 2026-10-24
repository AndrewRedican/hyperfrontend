import { existsSync } from 'node:fs'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createMarkdownWorkspace } from './__test-utils__/markdown-workspace.ts'
import rule from './root-readme-packages.ts'

const workspace = createMarkdownWorkspace()
const bare = createMarkdownWorkspace()
workspace.write('libs/pub/package.json', '{ "name": "@s/pub" }')
workspace.write(
  'libs/utils/json/project.json',
  '{ "name": "lib-json", "projectType": "library", "targets": { "build": {}, "publish": {} } }'
)
workspace.write('libs/utils/node_modules/skipped/project.json', '{ "projectType": "library", "targets": { "build": {}, "publish": {} } }')
workspace.write('libs/.hidden/project.json', '{ "projectType": "library", "targets": { "build": {}, "publish": {} } }')
workspace.write('plugins/anon/project.json', '{ "projectType": "library", "targets": { "build": {}, "publish": {} } }')
workspace.write('plugins/anon/notes.txt', '')
const README = workspace.rootFile('README.md')
const OPTIONS = { sections: ['Packages'] }

const row = (path: string): string => `| [x](https://github.com/o/r/blob/main/${path}) | words |`
const missing = (name: string, path: string, sections = "'Packages'"): string =>
  `Publishable library '${name}' (${path}) is not listed in any of these sections: ${sections}`
const section = (title: string, ...rows: string[]): string =>
  `## ${title}\n\n| Package | Description |\n| ------- | ----------- |\n${rows.join('\n')}\n`
const COMPLETE = section('Packages', row('libs/pub'), row('libs/utils/json'), row('plugins/anon'))

testRule(rule, {
  valid: [
    { name: 'every library listed under the configured section', path: README, text: `# Root\n\n${COMPLETE}`, options: OPTIONS },
    {
      name: 'libraries spread over the two default sections',
      path: README,
      text: `${section('Main Packages', row('libs/pub'))}\n${section('Internal Packages', row('libs/utils/json'), row('plugins/anon'))}`,
    },
    {
      name: 'a workspace without a plugins folder',
      path: bare.rootFile('README.md'),
      text: section('Packages', row('libs/pub')),
      options: OPTIONS,
    },
    { name: 'a readme that is not the root one', path: workspace.libraryFile('README.md'), text: '# Nothing\n', options: OPTIONS },
    { name: 'a markdown file that is no readme', path: workspace.rootFile('ARCHITECTURE.md'), text: '# Nothing\n', options: OPTIONS },
    { name: 'a readme outside any workspace', path: '/definitely/not/a/workspace/README.md', text: '# Nothing\n', options: OPTIONS },
  ],
  invalid: [
    {
      name: 'a missing section, reported over the whole document before any package is looked for',
      path: README,
      text: '# Root\n\n## Other\n',
      options: OPTIONS,
      errors: [{ message: "Root README.md must have a '## Packages' section", line: 1, column: 1, endLine: 4, endColumn: 1 }],
    },
    {
      name: 'both default sections missing',
      path: README,
      text: '# Root\n',
      errors: [
        { message: "Root README.md must have a '## Main Packages' section", line: 1, column: 1 },
        { message: "Root README.md must have a '## Internal Packages' section", line: 1, column: 1 },
      ],
    },
    {
      name: 'libraries left out, named by package name, project name or directory',
      path: README,
      text: `# Root\n\n${row('plugins/anon')}\n\n${section('Packages', row('libs/pub'), row('apps/site'), '| [y](https://github.com/o/r/blob/main/libs/utils/json | no close |')}\n### Still the section\n`,
      options: OPTIONS,
      errors: [
        { message: missing('lib-json', 'libs/utils/json'), line: 1, column: 1 },
        { message: missing('anon', 'plugins/anon'), line: 1, column: 1 },
      ],
    },
    {
      name: 'a link on a header-like row, which is skipped',
      path: README,
      text:
        section('Main Packages', `| Package ${row('libs/pub')}`, row('libs/utils/json'), row('plugins/anon')) +
        section('Internal Packages'),
      errors: [{ message: missing('@s/pub', 'libs/pub', "'Main Packages', 'Internal Packages'"), line: 1, column: 1 }],
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    workspace.remove()
    bare.remove()
    expect(existsSync(workspace.root) || existsSync(bare.root)).toBe(false)
  })
})
