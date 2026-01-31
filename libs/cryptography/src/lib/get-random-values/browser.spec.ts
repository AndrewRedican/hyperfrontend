/** @jest-environment jsdom */
import { getType } from '@hyperfrontend/data-utils'
import { getRandomValues } from './browser'

describe('getRandomValues (browser)', () => {
  it('creates a random value', () => {
    const randomValue = getRandomValues(4)
    expect(randomValue).not.toBeNull()
    expect(randomValue.length).toEqual(4)
    expect(getType(randomValue.at(0))).toEqual('number')
    expect(getType(randomValue.at(1))).toEqual('number')
    expect(getType(randomValue.at(2))).toEqual('number')
    expect(getType(randomValue.at(3))).toEqual('number')
  })

  it('throws error with 0 or empty byte length', () => {
    expect(() => getRandomValues(0)).toThrow('Cannot generate random values without a byte length.')
    expect(() => getRandomValues(<number>(<unknown>null))).toThrow('Cannot generate random values without a byte length.')
  })
})
