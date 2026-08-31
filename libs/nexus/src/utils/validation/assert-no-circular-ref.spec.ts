import { assertNoCircularRef } from './assert-no-circular-ref'

describe('assertNoCircularRef', () => {
  describe('non-circular values', () => {
    it('accepts primitive values', () => {
      expect(() => assertNoCircularRef(null, 'value')).not.toThrow()
      expect(() => assertNoCircularRef(undefined, 'value')).not.toThrow()
      expect(() => assertNoCircularRef(42, 'value')).not.toThrow()
      expect(() => assertNoCircularRef('string', 'value')).not.toThrow()
      expect(() => assertNoCircularRef(true, 'value')).not.toThrow()
      expect(() => assertNoCircularRef(Symbol(), 'value')).not.toThrow()
    })

    it('accepts empty objects', () => {
      expect(() => assertNoCircularRef({}, 'config')).not.toThrow()
    })

    it('accepts empty arrays', () => {
      expect(() => assertNoCircularRef([], 'list')).not.toThrow()
    })

    it('accepts nested objects without circular references', () => {
      const config = {
        a: 1,
        b: {
          c: 2,
          d: {
            e: 3,
          },
        },
      }
      expect(() => assertNoCircularRef(config, 'config')).not.toThrow()
    })

    it('accepts nested arrays without circular references', () => {
      const list = [1, [2, [3, [4]]]]
      expect(() => assertNoCircularRef(list, 'list')).not.toThrow()
    })

    it('accepts mixed nested structures without circular references', () => {
      const data = {
        items: [{ id: 1 }, { id: 2 }],
        metadata: {
          count: 2,
          tags: ['a', 'b'],
        },
      }
      expect(() => assertNoCircularRef(data, 'data')).not.toThrow()
    })
  })

  describe('frozen values', () => {
    it('accepts frozen objects without circular references', () => {
      const frozen = Object.freeze({ a: 1, b: 2 })
      expect(() => assertNoCircularRef(frozen, 'frozen')).not.toThrow()
    })

    it('accepts deeply frozen nested objects', () => {
      const deepFrozen = Object.freeze({
        a: Object.freeze({
          b: Object.freeze({
            c: 1,
          }),
        }),
      })
      expect(() => assertNoCircularRef(deepFrozen, 'deepFrozen')).not.toThrow()
    })

    it('accepts frozen arrays', () => {
      const frozen = Object.freeze([1, 2, 3])
      expect(() => assertNoCircularRef(frozen, 'frozenArray')).not.toThrow()
    })

    it('accepts mixed frozen and unfrozen structures', () => {
      const mixed = {
        frozen: Object.freeze({ a: 1 }),
        unfrozen: { b: 2 },
      }
      expect(() => assertNoCircularRef(mixed, 'mixed')).not.toThrow()
    })

    it('accepts nested frozen arrays in objects', () => {
      const data = Object.freeze({
        items: Object.freeze([Object.freeze({ id: 1 }), Object.freeze({ id: 2 })]),
      })
      expect(() => assertNoCircularRef(data, 'data')).not.toThrow()
    })
  })

  describe('circular values', () => {
    it('throws for self-referencing object', () => {
      const circular: Record<string, unknown> = { a: 1 }
      circular['self'] = circular
      expect(() => assertNoCircularRef(circular, 'config')).toThrow('Circular reference detected in parameter "config"')
    })

    it('throws for self-referencing array', () => {
      const circular: unknown[] = [1, 2]
      circular.push(circular)

      expect(() => assertNoCircularRef(circular, 'list')).toThrow('Circular reference detected in parameter "list"')
    })

    it('throws for deeply nested circular reference', () => {
      const circular: Record<string, unknown> = {
        a: {
          b: {
            c: {},
          },
        },
      }
      ;((circular.a as Record<string, unknown>).b as Record<string, unknown>).c = circular

      expect(() => assertNoCircularRef(circular, 'deep')).toThrow('Circular reference detected in parameter "deep"')
    })

    it('throws for indirect circular reference', () => {
      const a: Record<string, unknown> = { name: 'a' }
      const b: Record<string, unknown> = { name: 'b', ref: a }
      a['ref'] = b

      expect(() => assertNoCircularRef(a, 'indirect')).toThrow('Circular reference detected in parameter "indirect"')
    })

    it('throws for circular reference in array of objects', () => {
      const obj: Record<string, unknown> = { value: 1 }
      const arr = [obj]
      obj['parent'] = arr

      expect(() => assertNoCircularRef(arr, 'arrayWithCircular')).toThrow('Circular reference detected in parameter "arrayWithCircular"')
    })
  })

  describe('error messages', () => {
    it('includes parameter name in error message', () => {
      const circular: Record<string, unknown> = {}
      circular['self'] = circular

      expect(() => assertNoCircularRef(circular, 'myParam')).toThrow('Circular reference detected in parameter "myParam"')
    })

    it('throws Error instance', () => {
      const circular: Record<string, unknown> = {}
      circular['self'] = circular

      let caughtError: unknown
      try {
        assertNoCircularRef(circular, 'test')
      } catch (error) {
        caughtError = error
      }
      expect(caughtError).toBeInstanceOf(Error)
    })
  })
})
