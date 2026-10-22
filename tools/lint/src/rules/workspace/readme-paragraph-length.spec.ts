import { existsSync } from 'node:fs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { testRule } from '../../testing/rule-tester.ts'
import { createMarkdownWorkspace } from './__fixtures__/markdown-workspace.ts'
import rule from './readme-paragraph-length.ts'

const workspace = createMarkdownWorkspace()
const README = workspace.libraryFile('README.md')

// why: a paragraph of ordinary prose with an exact rendered length and no trailing space.
const prose = (characters: number): string => {
  let text = ''
  while (text.length < characters) text += 'measure '
  return text.slice(0, characters).trim().padEnd(characters, 'x')
}
const LONG = prose(760)
const SHORT = prose(120)

const message = (characters: number, maximum = 700): string =>
  `This paragraph is ${characters} characters, past the ${maximum} this file allows. Consider splitting it into focused ideas, or making it more concise. Prefer clearer prose over an arbitrary break.`

testRule(rule, {
  valid: [
    { name: 'ordinary prose', path: README, text: `# Title\n\n${SHORT}\n` },
    { name: 'a paragraph sitting exactly on the threshold', path: README, text: `${prose(700)}\n` },
    {
      name: 'a long url that does not count',
      path: README,
      text: `${prose(600)} [the reference](https://www.hyperfrontend.dev/${'segment/'.repeat(40)}page).\n`,
    },
    { name: 'an image that does not count', path: README, text: `${prose(600)} ![${prose(300)}](hero.gif)\n` },
    { name: 'inline html that does not count', path: README, text: `${prose(650)} <span data-note="${prose(300)}"></span>\n` },
    { name: 'a paragraph inside a list item', path: README, text: `- ${LONG}\n` },
    { name: 'a paragraph nested under a list item', path: README, text: `1. Step one\n\n   ${LONG}\n` },
    { name: 'a paragraph inside a blockquote', path: README, text: `> ${LONG}\n` },
    { name: 'a paragraph inside a footnote definition', path: README, text: `A claim.[^1]\n\n[^1]: ${LONG}\n` },
    { name: 'a long table cell', path: README, text: `| Option | Description |\n| --- | --- |\n| \`mode\` | ${LONG} |\n` },
    { name: 'a fenced code block', path: README, text: `\`\`\`typescript\n// ${LONG}\n\`\`\`\n` },
    { name: 'an indented code block', path: README, text: `Intro:\n\n    ${LONG}\n` },
    { name: 'a heading', path: README, text: `# ${LONG}\n` },
    { name: 'a table', path: README, text: `| ${prose(400)} | ${prose(400)} |\n| --- | --- |\n| ${prose(400)} | ${prose(400)} |\n` },
    {
      name: 'the html badge block a readme opens with',
      path: README,
      text: `<p align="center">\n  <img alt="${prose(400)}" src="x">\n</p>\n`,
    },
    {
      name: 'a link reference definition with a long target',
      path: README,
      text: `[docs]: https://www.hyperfrontend.dev/${'segment/'.repeat(120)}page\n`,
    },
    { name: 'a raised threshold', path: README, text: `${prose(900)}\n`, options: { maxCharacters: 1000 } },
    { name: 'an internal library', path: workspace.internalFile('README.md'), text: `${LONG}\n` },
    { name: 'a documentation directory', path: workspace.docsFile('guide.md'), text: `${LONG}\n` },
    { name: 'an application', path: workspace.appFile('README.md'), text: `${LONG}\n` },
    { name: 'a file outside any project', path: '/readme-paragraph-length-nowhere.md', text: `${LONG}\n` },
  ],
  invalid: [
    {
      name: 'a paragraph past the default threshold, at its own position',
      path: README,
      text: `# Title\n\nA short opening.\n\n${LONG}\n`,
      errors: [{ message: message(760), line: 5, column: 0, endLine: 5, endColumn: 760 }],
    },
    {
      name: 'one character past the threshold',
      path: README,
      text: `${prose(701)}\n`,
      errors: [{ message: message(701), line: 1, column: 0 }],
    },
    {
      name: 'a wrapped paragraph, measured as one line',
      path: README,
      text: `${LONG.split(' ').join('\n')}\n`,
      errors: [{ message: message(760), line: 1, column: 0, endLine: 95, endColumn: 8 }],
    },
    {
      name: 'inline code counted as prose',
      path: README,
      text: `${prose(600)} \`${prose(150)}\`\n`,
      errors: [{ message: message(751), line: 1, column: 0 }],
    },
    {
      name: 'emphasised and bold runs counted as prose',
      path: README,
      text: `${prose(600)} **${prose(80)}** _${prose(80)}_\n`,
      errors: [{ message: message(762), line: 1, column: 0 }],
    },
    {
      name: 'every offending paragraph, and body prose after an exempt container',
      path: README,
      text: `- ${LONG}\n\n${LONG}\n\n${SHORT}\n\n${prose(900)}\n`,
      errors: [
        { message: message(760), line: 3, column: 0 },
        { message: message(900), line: 7, column: 0 },
      ],
    },
    {
      name: 'a lowered threshold',
      path: README,
      text: `${prose(200)}\n`,
      options: { maxCharacters: 150 },
      errors: [{ message: message(200, 150), line: 1, column: 0 }],
    },
    {
      name: 'an empty option object',
      path: README,
      text: `${LONG}\n`,
      options: {},
      errors: [{ message: message(760), line: 1, column: 0 }],
    },
    {
      name: 'a readme nested inside the library',
      path: workspace.nestedFile('README.md'),
      text: `${LONG}\n`,
      errors: [{ message: message(760), line: 1, column: 0 }],
    },
    {
      name: 'the workspace root',
      path: workspace.rootFile('ARCHITECTURE.md'),
      text: `${LONG}\n`,
      errors: [{ message: message(760), line: 1, column: 0 }],
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    workspace.remove()
    expect(existsSync(workspace.root)).toBe(false)
  })
})
