import { describe, expect, it } from '@hyperfrontend/testing'
import { getLastKeyInMap } from './get-last-key-in-map'

describe('getLastKeyInMap', () => {
  it('returns the last key added to map', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = new Map<string, any>()
    map.set('hello', {})
    const afterFirstSet = getLastKeyInMap(map)

    map.set('world', 42)
    const afterSecondSet = getLastKeyInMap(map)

    expect({ afterFirstSet, afterSecondSet }).toEqual({ afterFirstSet: 'hello', afterSecondSet: 'world' })
  })
})
