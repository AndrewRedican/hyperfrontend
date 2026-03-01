import { broker, DEFAULT_CONTRACT } from './singleton'

describe('singleton', () => {
  describe('broker', () => {
    it('exports a broker instance', () => {
      expect(broker).toBeDefined()
      expect(broker.name).toBe('default-broker')
      expect(broker.id).toBeDefined()
    })

    it('has sensible default settings', () => {
      expect(broker.logger.getLogLevel()).toBe('error')
    })

    it('exposes channels list', () => {
      expect(Array.isArray(broker.channels)).toBe(true)
    })

    it('has default contract with expected action types', () => {
      expect(broker.acceptedActionTypes).toContain('MESSAGE')
      expect(broker.acceptedActionTypes).toContain('DATA')
      expect(broker.acceptedActionTypes).toContain('EVENT')
      expect(broker.acceptedActionTypes).toContain('ACK')
    })
  })

  describe('DEFAULT_CONTRACT', () => {
    it('exports the default contract', () => {
      expect(DEFAULT_CONTRACT).toBeDefined()
    })

    it('has emitted action types', () => {
      expect(DEFAULT_CONTRACT.emitted).toHaveLength(3)
      expect(DEFAULT_CONTRACT.emitted[0].type).toBe('MESSAGE')
      expect(DEFAULT_CONTRACT.emitted[1].type).toBe('DATA')
      expect(DEFAULT_CONTRACT.emitted[2].type).toBe('EVENT')
    })

    it('has accepted action types', () => {
      expect(DEFAULT_CONTRACT.accepted).toHaveLength(4)
      expect(DEFAULT_CONTRACT.accepted[0].type).toBe('MESSAGE')
      expect(DEFAULT_CONTRACT.accepted[1].type).toBe('DATA')
      expect(DEFAULT_CONTRACT.accepted[2].type).toBe('EVENT')
      expect(DEFAULT_CONTRACT.accepted[3].type).toBe('ACK')
    })
  })
})
