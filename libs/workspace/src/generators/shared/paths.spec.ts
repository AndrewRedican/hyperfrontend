import { describe, expect, it } from '@hyperfrontend/testing'
import { joinPathFragments, offsetFromRoot } from './paths'

describe('joinPathFragments', () => {
  it('joins and normalises fragments with forward slashes whatever separator they carry', () => {
    expect(joinPathFragments('libs', 'utils/data/', './package.json')).toBe('libs/utils/data/package.json')
  })
})

describe('offsetFromRoot', () => {
  it.each([
    ['.', './'],
    ['libs/utils/data', '../../../'],
    ['libs/', '../'],
    ['./apps/demos/clock', '../../../'],
  ])('climbs from %s to the root with %s', (directory, offset) => {
    expect(offsetFromRoot(directory)).toBe(offset)
  })
})
