import { describe, expect, it } from '@hyperfrontend/testing'
import { broker, DEFAULT_CONTRACT } from './singleton'

describe('singleton', () => {
  describe('broker', () => {
    it('exports a broker instance', () => {
      expect(broker).toEqual(expect.objectContaining({ name: 'default-broker', id: expect.anything() }))
    })

    it('has sensible default settings', () => {
      expect(broker.logger.getLogLevel()).toBe('error')
    })

    it('exposes channels list', () => {
      expect(Array.isArray(broker.channels)).toBe(true)
    })

    it('returns the same broker instance on repeated access', () => {
      expect(broker.id).toBe(broker.id)
    })

    it('reports broker members through the in operator', () => {
      expect('addChannel' in broker).toBe(true)
    })

    it('enumerates broker properties', () => {
      expect(Object.keys(broker)).toEqual(expect.arrayContaining(['id', 'name']))
    })

    it('reports no descriptor for unknown properties', () => {
      expect(Object.getOwnPropertyDescriptor(broker, 'notABrokerProperty')).toBeUndefined()
    })

    it('has default contract with expected action types', () => {
      expect(broker.acceptedActionTypes).toEqual(expect.arrayContaining(['MESSAGE', 'DATA', 'EVENT', 'ACK']))
    })
  })

  describe('DEFAULT_CONTRACT', () => {
    it('exports the default contract', () => {
      expect(DEFAULT_CONTRACT).toBeDefined()
    })

    it('has emitted action types', () => {
      expect(DEFAULT_CONTRACT.emitted.map((action) => action.type)).toEqual(['MESSAGE', 'DATA', 'EVENT'])
    })

    it('has accepted action types', () => {
      expect(DEFAULT_CONTRACT.accepted.map((action) => action.type)).toEqual(['MESSAGE', 'DATA', 'EVENT', 'ACK'])
    })
  })
})
