import type { Node } from './model'
import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { serialise } from './__fixtures__/serialise'
import { parseCode, scan } from './parse'

const FIXTURES = join(import.meta.dirname, '__fixtures__')

describe('parseCode', () => {
  for (const name of readdirSync(FIXTURES).filter((file) => /\.(ts|tsx|js|mjs|cjs)$/.test(file) && file !== 'serialise.ts')) {
    it(`parses ${name} as the reference parser does`, () => {
      const expected = readFileSync(join(FIXTURES, name.replace(/\.[a-z]+$/, '.tree')), 'utf8').trimEnd()
      const parsed = parseCode(readFileSync(join(FIXTURES, name), 'utf8'), extname(name))
      expect(parsed.tree === null ? `error ${parsed.error?.message ?? ''}` : serialise(parsed.tree).join('\n')).toBe(expected)
    })
  }

  it('decodes legacy octal escapes and the digits 8 and 9 in a script', () => {
    const parsed = parseCode("'\\101\\8\\9\\0\\12\\477'", '.js', 'script')
    expect(((parsed.tree?.body as Node[])[0]?.expression as Node).value).toBe("A89\0\n'7")
  })

  it('leaves the invalid escapes of a tagged template uncooked in a script', () => {
    const parsed = parseCode('tag`\\8`', '.js', 'script')
    const template = ((parsed.tree?.body as Node[])[0]?.expression as Node).quasi as Node
    expect((template.quasis as Node[])[0]?.value).toEqual({ raw: '\\8', cooked: null })
  })

  it('sets every node parent', () => {
    const parsed = parseCode('const a = b.c\n', '.ts')
    const declaration = parsed.tree?.body?.[0 as keyof typeof parsed.tree.body] as unknown as {
      parent: unknown
      declarations: { parent: unknown }[]
    }
    expect([declaration.parent === parsed.tree, declaration.declarations[0].parent === declaration]).toEqual([true, true])
  })

  it('parses deeply nested parenthesised defaults without retrying each failed arrow function', () => {
    const text = `x = ${'(a = '.repeat(40)}1${')'.repeat(40)}\n`
    const started = performance.now()
    parseCode(text, '.ts')
    expect(performance.now() - started).toBeLessThan(1000)
  })
})

describe('scan', () => {
  it('answers the tokens, comments and a parse verdict', () => {
    expect(scan('a // c\n', '.ts')).toEqual({
      tokens: [{ category: 'word', start: 0, end: 1 }],
      comments: [{ start: 2, end: 6, block: false }],
      error: null,
    })
  })

  it('names the error and where it was found', () => {
    expect(scan('const = 1\n', '.ts').error).toBe('Identifier expected. (6)')
  })
})
