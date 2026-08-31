import { describe, expect, it } from '@hyperfrontend/testing'
import { getLastKeyInMap } from './get-last-key-in-map'

describe('getLastKeyInMap', () => {
  it('returns the last key added to map', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = new Map<string, any>()
    map.set('hello', {})
    expect(getLastKeyInMap(map)).toEqual('hello')

    map.set('world', 42)
    expect(getLastKeyInMap(map)).toEqual('world')
  })
})
