import { CircularReference } from './circular-reference'

describe('CircularReference', () => {
  let circularRef: CircularReference

  beforeEach(() => (circularRef = new CircularReference(['a', 'b', 'c', 'd'], ['a', 'b'])))

  it('creates an instance', () => {
    expect(circularRef).toBeInstanceOf(CircularReference)
  })

  it('throws error when incorrect location is provided', () => {
    expect(() => new CircularReference(<[string]>(<unknown>[]), ['a', 'b'])).toThrow(
      'Expected location to be a list with at list one string value.'
    )
    expect(() => new CircularReference(null, ['a', 'b'])).toThrow('Expected location to be a list with at list one string value.')
  })

  it('throws error when incorrect target is provided', () => {
    expect(() => new CircularReference(['a', 'b'], null)).toThrow('Expected target to be a list.')
  })

  describe('depth', () => {
    it('returns the distance between the location and reference target', () => {
      expect(circularRef.depth).toBe(2)
    })
  })

  describe('toString', () => {
    it('returns a string representation', () => {
      expect(circularRef.toString()).toEqual('a\u00B7b\u00B7c\u00B7d \u2192 a\u00B7b')
    })
  })

  describe('toJSON', () => {
    it('returns a JSON representation', () => {
      expect(circularRef.toJSON()).toEqual('a\u00B7b\u00B7c\u00B7d \u2192 a\u00B7b')
    })
  })
})
