import { getType } from '@hyperfrontend/data-utils'
import { describe, expect, it } from '@hyperfrontend/testing'
import { getRandomValues } from './node'

describe('getRandomValues (node)', () => {
  it('creates a random value', () => {
    const randomValue = getRandomValues(4)
    expect({
      length: randomValue.length,
      types: [0, 1, 2, 3].map((index) => getType(randomValue.at(index))),
    }).toEqual({ length: 4, types: ['number', 'number', 'number', 'number'] })
  })

  it('throws error with 0 byte length', () => {
    expect(() => getRandomValues(0)).toThrow('Cannot generate random values without a byte length.')
  })

  it('throws error with empty byte length', () => {
    expect(() => getRandomValues(null as unknown as number)).toThrow('Cannot generate random values without a byte length.')
  })
})
