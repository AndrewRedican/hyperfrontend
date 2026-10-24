import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createMarkdownWorkspace } from './__test-utils__/markdown-workspace.ts'
import rule from './readme-media-asset.ts'

const workspace = createMarkdownWorkspace()
workspace.write('assets/media/koi/hero.gif', '')
workspace.write('assets/media/koi/hero.dark.gif', '')
const README = workspace.libraryFile('README.md')
const OPTIONS = { baseUrl: 'https://www.hyperfrontend.dev/media/', assetRoot: 'assets/media' }
const HERO = 'https://www.hyperfrontend.dev/media/koi/hero.gif'

const notSite = (url: string): string =>
  `README media must use the absolute https://www.hyperfrontend.dev/media/ URL so it renders on npm, on GitHub and on the docs site. Found: ${url}`
const themed = (url: string): string =>
  `README media must reference the portable file; ${url} is a theme-specific variant the documentation site swaps in for itself.`
const missing = (relative: string): string =>
  `No committed asset at ${join(workspace.root, 'assets', 'media', relative)}. Record it before referencing it, or correct the URL.`

testRule(rule, {
  valid: [
    {
      name: 'a committed asset by its site url, as an image and as html',
      path: README,
      text: `![The pond](${HERO})\n<img width="560" src="${HERO}" alt="x">\n`,
      options: OPTIONS,
    },
    { name: 'a query string after the file', path: README, text: `![x](${HERO}?v=2)\n`, options: OPTIONS },
    {
      name: 'a status badge',
      path: README,
      text: '<img src="https://img.shields.io/npm/v/x.png">\n![c](https://codecov.io/gh/x/badge.svg)\n',
      options: OPTIONS,
    },
    { name: 'a reference that is not media', path: README, text: '![doc](./ARCHITECTURE.md) <a href="x.gif">\n', options: OPTIONS },
    { name: 'a reference inside fenced code', path: README, text: '```markdown\n![x](./hero.gif)\n```\n', options: OPTIONS },
    { name: 'the workspace root readme', path: workspace.rootFile('README.md'), text: '![x](./logo.png)\n', options: OPTIONS },
    { name: 'a file that is no readme', path: workspace.libraryFile('ARCHITECTURE.md'), text: '![x](./hero.gif)\n', options: OPTIONS },
    { name: 'no options', path: README, text: '![x](./hero.gif)\n' },
    { name: 'the base url alone', path: README, text: '![x](./hero.gif)\n', options: { baseUrl: OPTIONS.baseUrl } },
    { name: 'the asset root alone', path: README, text: '![x](./hero.gif)\n', options: { assetRoot: OPTIONS.assetRoot } },
    { name: 'a readme outside any workspace', path: '/definitely/not/a/workspace/README.md', text: '![x](./hero.gif)\n', options: OPTIONS },
  ],
  invalid: [
    {
      name: 'a relative path, at the url and over its length',
      path: README,
      text: '# Title\n\n![The pond](./assets/hero.gif)\n',
      options: OPTIONS,
      errors: [{ message: notSite('./assets/hero.gif'), line: 3, column: 12, endLine: 3, endColumn: 29 }],
    },
    {
      name: 'a raw github url in an html source, upper-cased extension',
      path: README,
      text: '<img src="https://github.com/x/y/blob/main/assets/media/koi/hero.GIF?raw=true">\n',
      options: OPTIONS,
      errors: [{ message: notSite('https://github.com/x/y/blob/main/assets/media/koi/hero.GIF?raw=true'), line: 1, column: 10 }],
    },
    {
      name: 'a themed variant',
      path: README,
      text: `<img srcset='https://www.hyperfrontend.dev/media/koi/hero.dark.gif'>\n`,
      options: OPTIONS,
      errors: [{ message: themed('https://www.hyperfrontend.dev/media/koi/hero.dark.gif'), line: 1, column: 13 }],
    },
    {
      name: 'an asset that is not committed',
      path: README,
      text: '![x](https://www.hyperfrontend.dev/media/koi/nothing-here.gif)\n',
      options: OPTIONS,
      errors: [{ message: missing(join('koi', 'nothing-here.gif')), line: 1, column: 5 }],
    },
    {
      name: 'two references on one line, each at its own column',
      path: README,
      text: '![a](./a.png) ![b](./b.webp)\n',
      options: OPTIONS,
      errors: [
        { message: notSite('./a.png'), line: 1, column: 5, endLine: 1, endColumn: 12 },
        { message: notSite('./b.webp'), line: 1, column: 19, endLine: 1, endColumn: 27 },
      ],
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    workspace.remove()
    expect(existsSync(workspace.root)).toBe(false)
  })
})
