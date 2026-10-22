import type { MarkdownNode } from './model.ts'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { parseMarkdown } from './parse.ts'

const FIXTURES = join(import.meta.dirname, '__fixtures__')
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
  for (const name of readdirSync(FIXTURES).filter((file) => file.endsWith('.md'))) {
    it(`parses ${name} as the reference parser does`, () => {
      const expected = readFileSync(join(FIXTURES, name.replace(/\.md$/, '.tree')), 'utf8')
        .trimEnd()
        .split(/\r?\n/)
      const actual = serialise(parseMarkdown(readFileSync(join(FIXTURES, name), 'utf8')), 0, [])
      expect(withoutDroppedPositions(actual, expected).join('\n')).toBe(expected.join('\n'))
    })
  }
})
