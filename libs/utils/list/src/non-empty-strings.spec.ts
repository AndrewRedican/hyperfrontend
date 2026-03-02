import { nonEmptyStrings } from './non-empty-strings'

describe('nonEmptyStrings', () => {
  it('filters out empty strings', () => {
    const input = ['hello', '', 'world']
    const expectedOutput = ['hello', 'world']
    expect(nonEmptyStrings(input)).toEqual(expectedOutput)
  })

  it('filters out strings with only whitespace', () => {
    const input = ['hello', '  ', 'world']
    const expectedOutput = ['hello', 'world']
    expect(nonEmptyStrings(input)).toEqual(expectedOutput)
  })

  it('handles an array with only invalid strings', () => {
    const input = ['', ' ', '   ']
    expect(nonEmptyStrings(input)).toEqual([])
  })

  it('returns an empty array when provided an empty array', () => {
    expect(nonEmptyStrings([])).toEqual([])
  })

  it('handles null and undefined values correctly', () => {
    const input = <string[]>['hello', null, undefined, 'world']
    const expectedOutput = ['hello', 'world']
    expect(nonEmptyStrings(input)).toEqual(expectedOutput)
  })

  it('returns the same array if all elements are valid', () => {
    const input = ['apple', 'banana', 'orange']
    const expectedOutput = ['apple', 'banana', 'orange']
    expect(nonEmptyStrings(input)).toEqual(expectedOutput)
  })
})
