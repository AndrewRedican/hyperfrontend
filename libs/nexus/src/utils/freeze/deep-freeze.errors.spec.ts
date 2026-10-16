import type { Logger } from '@hyperfrontend/logging'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { deepFreeze } from './deep-freeze'
jest.unmock('@hyperfrontend/immutable-api-utils/built-in-copy/object')

/**
 * Lists the named nodes that are not frozen, so one comparison covers every level of a structure and a failure names the levels that stayed mutable.
 *
 * @param nodes - The nodes to inspect, keyed by the name a failure should show.
 * @returns The names of the nodes `Object.isFrozen` reports as not frozen, in the order given.
 */
function unfrozenNodes(nodes: Record<string, unknown>): string[] {
  return Object.entries(nodes)
    .filter(([, node]) => !Object.isFrozen(node))
    .map(([name]) => name)
}

describe('deepFreeze', () => {
  let mockLogger: Logger

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn(),
      getLogLevel: jest.fn(() => 'error'),
      channel: jest.fn(),
      timed: jest.fn(),
      timedAsync: jest.fn(),
    }
  })

  describe('graceful degradation', () => {
    it('freezes what it can when some nodes fail', () => {
      const obj = {
        normal: { value: 1 },
        anotherNormal: { value: 2 },
      }

      const result = deepFreeze(obj, mockLogger)

      expect(unfrozenNodes({ root: result, normal: result.normal, anotherNormal: result.anotherNormal })).toEqual([])
    })

    it.each([[42], ['string'], [null], [undefined]])('returns %p unchanged when a primitive is passed', (value: unknown) => {
      expect(deepFreeze(value, mockLogger)).toBe(value)
    })
  })

  describe('error handling edge cases', () => {
    const objectWithUnfreezableNode = () => {
      const throwingProxy = new Proxy(
        { value: 1 },
        {
          preventExtensions: () => {
            throw new Error('Cannot freeze this object')
          },
        }
      )

      return {
        normal: { value: 'normal' },
        problematic: throwingProxy,
        anotherNormal: { value: 'also normal' },
      }
    }

    it('logs a debug entry with the depth and error of the node that fails to freeze', () => {
      deepFreeze(objectWithUnfreezableNode(), mockLogger)

      // why: the unfreezable proxy sits directly under the root, at depth 1, and its preventExtensions trap throws this error.
      expect(mockLogger.debug).toHaveBeenCalledWith('Failed to freeze node at depth', 1, new Error('Cannot freeze this object'))
    })

    it('keeps freezing the other nodes when one fails to freeze', () => {
      const obj = objectWithUnfreezableNode()

      deepFreeze(obj, mockLogger)

      expect(unfrozenNodes({ root: obj, normal: obj.normal, anotherNormal: obj.anotherNormal })).toEqual([])
    })

    it('does not throw when a property getter throws during traversal', () => {
      const obj = Object.create(null)
      Object.defineProperty(obj, 'trap', {
        get: () => {
          throw new Error('Traversal trap triggered')
        },
        enumerable: true,
      })

      expect(() => deepFreeze(obj, mockLogger)).not.toThrow()
    })

    it('returns the original value when traversal fails', () => {
      const problematic = {
        get badProperty(): unknown {
          throw new Error('Property access error')
        },
      }

      const result = deepFreeze(problematic, mockLogger)
      expect(result).toBe(problematic)
    })

    it('handles objects with non-configurable throwing getters', () => {
      const obj: Record<string, unknown> = { normal: { value: 1 } }
      Object.defineProperty(obj, 'throwing', {
        get: () => {
          throw new Error('Getter throws')
        },
        enumerable: true,
        configurable: false,
      })

      expect(() => deepFreeze(obj, mockLogger)).not.toThrow()
    })

    it('handles revoked proxies gracefully', () => {
      const { proxy, revoke } = Proxy.revocable({ value: 1 }, {})
      const obj = { child: proxy }

      revoke()

      expect(() => deepFreeze(obj, mockLogger)).not.toThrow()
    })
  })
})
