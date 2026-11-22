import { join } from 'node:path'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { commentText, generateFiles, renderExpression, renderTemplate } from './templates'

const values = { packageName: '@scope/pkg', projectRoot: 'libs/pkg', glyphs: { node: 'yes' }, empty: null }

describe('renderExpression', () => {
  it.each([
    ['packageName', '@scope/pkg'],
    [' glyphs.node ', 'yes'],
    ['glyphs.missing', ''],
    ['empty', ''],
    ['projectRoot.replace("libs/", "")', 'pkg'],
    ["projectRoot.replace('/', '-')", 'libs-pkg'],
    ['empty.replace("a", "b")', ''],
    ['glyphs.missing.replace("a", "b")', ''],
    ['empty.member', ''],
    ['packageName.length', ''],
  ])('renders %s as %s', (expression, text) => {
    expect(renderExpression(expression, values)).toBe(text)
  })

  it('refuses a name the substitutions lack', () => {
    expect(() => renderExpression('unknown.member', values)).toThrow('unknown.member is not defined for the template')
  })

  it.each([
    ['projectRoot.replace(/x/, "")'],
    ['projectRoot.replace("a")'],
    ['projectRoot.replace("a", "b", "c")'],
    ['projectRoot.replace("a, "b")'],
    ["projectRoot.replace(\"a', 'b')"],
    ['projectRoot.replace(", "b")'],
  ])('refuses %s, a replace call without two quoted strings', (expression) => {
    expect(() => renderExpression(expression, values)).toThrow('two quoted strings')
  })

  it('refuses a replace call that is not closed', () => {
    expect(() => renderExpression('projectRoot.replace("a", "b"', values)).toThrow('unterminated call')
  })
})

describe('renderTemplate', () => {
  it('replaces every tag and keeps the text between them', () => {
    expect(renderTemplate('name: <%= packageName %>\nroot: <%- projectRoot %>!', values)).toBe('name: @scope/pkg\nroot: libs/pkg!')
  })

  it('refuses a tag that is never closed', () => {
    expect(() => renderTemplate('a <%= packageName', values)).toThrow('opened at offset 2 is never closed')
  })
})

describe('generateFiles', () => {
  const templates = useTempDir({
    prefix: 'templates-',
    tree: { 'package.json.template': '{ "name": "<%= packageName %>" }\n', 'src/index.ts': 'export const root = "<%= projectRoot %>"\n' },
  })
  const empty = useTempDir({ prefix: 'empty-' })

  it('writes every template under the target without its suffix', () => {
    const tree = createMemoryTree()
    generateFiles(tree, templates.path, 'libs/pkg', values)
    expect(tree.listChanges().map((change) => [change.path, change.content?.toString('utf-8')])).toEqual([
      ['libs/pkg/package.json', '{ "name": "@scope/pkg" }\n'],
      ['libs/pkg/src/index.ts', 'export const root = "libs/pkg"\n'],
    ])
  })

  it('keeps a file already at its target when asked to', () => {
    const tree = createMemoryTree({ 'libs/pkg/package.json': 'kept' })
    generateFiles(tree, templates.path, 'libs/pkg', values, { keepExisting: true })
    expect(tree.listChanges().map((change) => change.path)).toEqual(['libs/pkg/src/index.ts'])
  })

  it('refuses a directory without files', () => {
    expect(() => generateFiles(createMemoryTree(), join(empty.path), 'libs/pkg', values)).toThrow('no files found')
  })
})

describe('commentText', () => {
  it.each([
    ['a plain line', 'Serves the site.', 'Serves the site.'],
    ['the end of a comment', 'Serves */ things', 'Serves *\\/ things'],
    ['every end of a comment', 'a */ b **/ c', 'a *\\/ b **\\/ c'],
    ['several lines', 'First.\nSecond.\r\nThird.', 'First.\n * Second.\n * Third.'],
    ['an empty line between two', 'First.\n\nSecond.', 'First.\n *\n * Second.'],
    ['a first line that opens with a scoped package', "@acme/core's test helpers.", "`@acme/core`'s test helpers."],
    ['a further line that opens with a tag', 'First.\n@module evil', 'First.\n * `@module` evil'],
    ['an indented line that opens with an at sign', '  @internal.', '  `@internal`.'],
    ['an at sign that opens a line alone', '@ home', '`@` home'],
    ['a word after an at sign that ends in punctuation', '@acme/core_. Helpers', '`@acme/core`_. Helpers'],
    ['an at sign with nothing but punctuation after it', '@-- dashes', '`@`-- dashes'],
    ['an at sign inside a line', 'Mail us @acme/core or user@example.test', 'Mail us @acme/core or user@example.test'],
  ])('writes %s as the lines of a block comment hold it', (_what, text, expected) => {
    expect(commentText(text)).toBe(expected)
  })
})
