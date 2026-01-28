import { uniqueStrings } from './unique-strings'

describe('uniqueStrings', () => {
  it('returns a list of unique strings', () => {
    const strings = ['apple', 'banana', 'apple', 'orange', 'banana', 'kiwi']
    const result = uniqueStrings(strings)
    const unique = ['apple', 'banana', 'orange', 'kiwi']
    expect(result).toEqual(unique)
  })
})
