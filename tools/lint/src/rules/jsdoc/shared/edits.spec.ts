import { describe, expect, it } from '@hyperfrontend/testing'
import { parseJsdoc } from '../../../jsdoc/parse.ts'
import { replaceLine } from './edits.ts'

/** A block after code on its first line, two lines long. */
const TEXT = 'f(/** A\n * B */)'

/** The block parsed. */
const BLOCK = parseJsdoc(TEXT, 2, 15, [0, 8])

describe('replaceLine', () => {
  it('replaces the first line from the opening delimiter', () => {
    expect(replaceLine(BLOCK, BLOCK.lines[0], { ...BLOCK.lines[0].tokens, description: 'C' })).toEqual({ start: 2, end: 7, text: '/** C' })
  })

  it('replaces a later line from its start', () => {
    expect(replaceLine(BLOCK, BLOCK.lines[1], { ...BLOCK.lines[1].tokens, description: 'D ' })).toEqual({
      start: 8,
      end: 15,
      text: ' * D */',
    })
  })
})
