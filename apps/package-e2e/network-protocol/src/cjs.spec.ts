/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/network-protocol
 * Tests that the package sub-entries are requireable and exports work correctly.
 *
 * Note: network-protocol has many sub-entries for browser/node variants.
 * In Node.js environment, we test the node-specific entries.
 */

describe('@hyperfrontend/network-protocol CJS', () => {
  describe('node/v1 sub-entry', () => {
    it('should be requireable', () => {
      const v1 = require('@hyperfrontend/network-protocol/node/v1')
      expect(v1).toBeDefined()
    })

    it('should export createProtocol function', () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v1')
      expect(typeof createProtocol).toBe('function')
    })
  })

  describe('node/v2 sub-entry', () => {
    it('should be requireable', () => {
      const v2 = require('@hyperfrontend/network-protocol/node/v2')
      expect(v2).toBeDefined()
    })

    it('should export createProtocol function', () => {
      const { createProtocol } = require('@hyperfrontend/network-protocol/node/v2')
      expect(typeof createProtocol).toBe('function')
    })
  })

  describe('node/channel sub-entry', () => {
    it('should be requireable', () => {
      const channel = require('@hyperfrontend/network-protocol/node/channel')
      expect(channel).toBeDefined()
    })
  })

  describe('node/data sub-entry', () => {
    it('should be requireable', () => {
      const data = require('@hyperfrontend/network-protocol/node/data')
      expect(data).toBeDefined()
    })
  })

  describe('node/packet sub-entry', () => {
    it('should be requireable', () => {
      const packet = require('@hyperfrontend/network-protocol/node/packet')
      expect(packet).toBeDefined()
    })
  })

  describe('node/sender sub-entry', () => {
    it('should be requireable', () => {
      const sender = require('@hyperfrontend/network-protocol/node/sender')
      expect(sender).toBeDefined()
    })
  })

  describe('node/receiver sub-entry', () => {
    it('should be requireable', () => {
      const receiver = require('@hyperfrontend/network-protocol/node/receiver')
      expect(receiver).toBeDefined()
    })
  })

  describe('queue sub-entry (shared)', () => {
    it('should be requireable', () => {
      const queue = require('@hyperfrontend/network-protocol/queue')
      expect(queue).toBeDefined()
    })
  })

  describe('routing sub-entry (shared)', () => {
    it('should be requireable', () => {
      const routing = require('@hyperfrontend/network-protocol/routing')
      expect(routing).toBeDefined()
    })
  })

  describe('security sub-entry (shared)', () => {
    it('should be requireable', () => {
      const security = require('@hyperfrontend/network-protocol/security')
      expect(security).toBeDefined()
    })
  })

  describe('topic sub-entry (shared)', () => {
    it('should be requireable', () => {
      const topic = require('@hyperfrontend/network-protocol/topic')
      expect(topic).toBeDefined()
    })
  })
})
