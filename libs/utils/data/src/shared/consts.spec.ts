import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { marker } from '../marker'
import { getConfig, setConfig, registeredIterableClasses } from './consts'

describe('getConfig / setConfig', () => {
  it('can toggle wheather or not order of properties matter for equality checks', () => {
    setConfig({ samePositionOfOwnProperties: true })
    expect(getConfig().samePositionOfOwnProperties).toBe(true)

    setConfig({ samePositionOfOwnProperties: false })
    expect(getConfig().samePositionOfOwnProperties).toBe(false)
  })

  it('can toggle whether or not will detect circular references', () => {
    setConfig({ detectCircularReferences: true })
    expect(getConfig().detectCircularReferences).toBe(true)

    setConfig({ detectCircularReferences: false })
    expect(getConfig().detectCircularReferences).toBe(false)
  })

  it('does not change flag that has not been explicitly set', () => {
    const originalConfig = { ...getConfig() }
    setConfig({})
    expect(getConfig()).toEqual(originalConfig)
  })
})

describe('built-in iterable classes', () => {
  describe('Object', () => {
    beforeEach(() => setConfig({ detectCircularReferences: true }))

    afterEach(() => setConfig({ detectCircularReferences: false }))

    describe('getKey', () => {
      it('discerns beteen a real key and a marker when circular reference detection is active', () => {
        expect(registeredIterableClasses[0].getKeys({ a: true, [marker()]: Symbol() })).toEqual(['a'])
      })
    })
  })

  describe('Array', () => {
    beforeEach(() => setConfig({ detectCircularReferences: true }))

    afterEach(() => setConfig({ detectCircularReferences: false }))

    describe('getKey', () => {
      it('discerns beteen a real key and a marker when circular reference detection is active', () => {
        expect(registeredIterableClasses[0].getKeys({ a: true, [marker()]: Symbol() })).toEqual(['a'])
      })
    })
  })
})
