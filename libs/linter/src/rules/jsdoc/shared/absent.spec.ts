import { describe, expect, it } from '@hyperfrontend/testing'
import { parseJsdoc } from '../../../jsdoc/parse'
import { admitsUndefined } from './absent'

/**
 * The `@returns` tag of a one-line block with the given type.
 *
 * @param type - The type between the braces
 * @returns The parsed tag
 */
function returnsTag(type: string): ReturnType<typeof parseJsdoc>['tags'][number] {
  const text = `/** @returns {${type}} */`
  return parseJsdoc(text, 0, text.length, [0]).tags[0] as ReturnType<typeof parseJsdoc>['tags'][number]
}

describe('admitsUndefined', () => {
  it('admits any', () => {
    expect(admitsUndefined(returnsTag('any'))).toBe(true)
  })

  it('admits a union holding void', () => {
    expect(admitsUndefined(returnsTag('string|void'))).toBe(true)
  })

  it('refuses a union of values', () => {
    expect(admitsUndefined(returnsTag('string|number'))).toBe(false)
  })

  it('refuses a plain type', () => {
    expect(admitsUndefined(returnsTag('string'))).toBe(false)
  })
})
