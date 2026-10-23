import { describe, expect, it } from '@hyperfrontend/testing'
import { parseJsdoc } from '../../../jsdoc/parse'
import { removeBlock, removeTag } from './rewrite'

/**
 * The line starts of a text.
 *
 * @param text - The text whose lines are found
 * @returns The offsets where its lines start
 */
function starts(text: string): number[] {
  const found = [0]
  for (let at = 0; at < text.length; at += 1) if (text[at] === '\n') found.push(at + 1)
  return found
}

/**
 * Parses the block of a text that starts at the given offset and runs to the first close.
 *
 * @param text - The text parsed
 * @param start - The offset of `/**`
 * @returns The parsed block
 */
function blockOf(text: string, start = 0): ReturnType<typeof parseJsdoc> {
  return parseJsdoc(text, start, text.indexOf('*/', start) + 2, starts(text))
}

describe('removeBlock', () => {
  it('takes the line break and indentation before a block alone on its line', () => {
    expect(removeBlock('a\n  /** x */\nb', blockOf('a\n  /** x */\nb', 4))).toEqual({ start: 1, end: 12, text: '' })
  })

  it('takes the spaces and line break after a block that follows code', () => {
    expect(removeBlock('a /** x */ \t\nb', blockOf('a /** x */ \t\nb', 2))).toEqual({ start: 2, end: 13, text: '' })
  })

  it('keeps the line break before a block that follows code on a later line', () => {
    expect(removeBlock('a\nb /** x */', blockOf('a\nb /** x */', 4))).toEqual({ start: 4, end: 12, text: '' })
  })
})

describe('removeTag', () => {
  it('empties a closing line holding the tag', () => {
    const text = '/**\n * A\n * @b x */'
    const block = blockOf(text)
    expect(removeTag(text, block, block.tags[0])).toEqual({ start: 0, end: 19, text: '/**\n * A\n **/' })
  })

  it('removes a tag with its continuation lines', () => {
    const text = '/**\n * @a x\n * more\n * @b\n */'
    const block = blockOf(text)
    expect(removeTag(text, block, block.tags[0])).toEqual({ start: 0, end: 29, text: '/**\n * @b\n */' })
  })

  it('removes a block left without tags or description', () => {
    const text = '/** @a */\nb'
    const block = blockOf(text)
    expect(removeTag(text, block, block.tags[0])).toEqual({ start: 0, end: 10, text: '' })
  })
})
