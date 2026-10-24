import type { MarkdownNode } from './model'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { PARSE_CASES } from './__test-utils__/parse-cases'
import { parseMarkdown } from './parse'

const FIELDS = ['depth', 'lang', 'meta', 'value', 'url', 'title', 'alt', 'ordered', 'start', 'checked', 'identifier', 'align'] as const

// why: one line per node, in the form the reference trees were written in.
const serialise = (node: MarkdownNode, depth: number, lines: string[]): string[] => {
  const { start, end } = node.position
  const where = `${start.line}:${start.column}:${start.offset}-${end.line}:${end.column}:${end.offset}`
  const fields = FIELDS.filter((field) => node[field] !== undefined).map((field) => ` ${field}=${stringify(node[field])}`)
  lines.push(`${'  '.repeat(depth)}${node.kind} ${where}${fields.join('')}`)
  for (const child of node.children ?? []) serialise(child, depth + 1, lines)
  return lines
}

// why: the reference parser drops the positions of nodes it re-tokenises after a failed link; those lines compare without a position.
const withoutDroppedPositions = (actual: string[], expected: string[]): string[] =>
  actual.map((line, index) => (expected[index]?.includes(' nowhere') ? line.replace(/ \d+:\d+:\d+-\d+:\d+:\d+/, ' nowhere') : line))

describe('parseMarkdown', () => {
  for (const { name, source, tree } of PARSE_CASES) {
    it(`parses ${name} as the reference parser does`, () => {
      const expected = tree.trimEnd().split(/\r?\n/)
      const actual = serialise(parseMarkdown(source), 0, [])
      expect(withoutDroppedPositions(actual, expected).join('\n')).toBe(expected.join('\n'))
    })
  }

  it('opens a raw HTML block only on a raw tag name that ends there', () => {
    const kinds = (text: string): string[] => (parseMarkdown(text).children ?? []).map((node) => node.kind)
    expect([kinds('<script>\n\n*a*'), kinds('<scripts>\n\n*a*')]).toEqual([['html'], ['html', 'paragraph']])
  })
})
