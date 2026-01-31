import { createRange } from './create-range'

describe('createRange', () => {
  it('creates a range from 1 to 5', () => {
    expect(createRange(1, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('creates an empty array when start is greater than end', () => {
    expect(createRange(5, 1)).toEqual([])
  })
})
