/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/network-protocol`
 * Tests that the package sub-entries are importable and exports work correctly.
 *
 * Note: network-protocol has many sub-entries for browser/node variants.
 * In Node.js environment, we test the node-specific entries.
 */

import { describe, expect, it } from '@hyperfrontend/testing'

describe('@hyperfrontend/network-protocol ESM', () => {
  describe('node/v1 sub-entry', () => {
    it('is importable', async () => {
      const v1 = await import('@hyperfrontend/network-protocol/node/v1')
      expect(v1).toBeDefined()
    })

    it('exports createProtocol function', async () => {
      const { createProtocol } = await import('@hyperfrontend/network-protocol/node/v1')
      expect(typeof createProtocol).toBe('function')
    })
  })

  describe('node/v2 sub-entry', () => {
    it('is importable', async () => {
      const v2 = await import('@hyperfrontend/network-protocol/node/v2')
      expect(v2).toBeDefined()
    })

    it('exports createProtocol function', async () => {
      const { createProtocol } = await import('@hyperfrontend/network-protocol/node/v2')
      expect(typeof createProtocol).toBe('function')
    })
  })

  describe('node/channel sub-entry', () => {
    it('is importable', async () => {
      const channel = await import('@hyperfrontend/network-protocol/node/channel')
      expect(channel).toBeDefined()
    })
  })

  describe('node/data sub-entry', () => {
    it('is importable', async () => {
      const data = await import('@hyperfrontend/network-protocol/node/data')
      expect(data).toBeDefined()
    })
  })

  describe('node/packet sub-entry', () => {
    it('is importable', async () => {
      const packet = await import('@hyperfrontend/network-protocol/node/packet')
      expect(packet).toBeDefined()
    })
  })

  describe('node/sender sub-entry', () => {
    it('is importable', async () => {
      const sender = await import('@hyperfrontend/network-protocol/node/sender')
      expect(sender).toBeDefined()
    })
  })

  describe('node/receiver sub-entry', () => {
    it('is importable', async () => {
      const receiver = await import('@hyperfrontend/network-protocol/node/receiver')
      expect(receiver).toBeDefined()
    })
  })

  describe('queue sub-entry (shared)', () => {
    it('is importable', async () => {
      const queue = await import('@hyperfrontend/network-protocol/queue')
      expect(queue).toBeDefined()
    })
  })

  describe('routing sub-entry (shared)', () => {
    it('is importable', async () => {
      const routing = await import('@hyperfrontend/network-protocol/routing')
      expect(routing).toBeDefined()
    })
  })

  describe('security sub-entry (shared)', () => {
    it('is importable', async () => {
      const security = await import('@hyperfrontend/network-protocol/security')
      expect(security).toBeDefined()
    })
  })

  describe('topic sub-entry (shared)', () => {
    it('is importable', async () => {
      const topic = await import('@hyperfrontend/network-protocol/topic')
      expect(topic).toBeDefined()
    })
  })
})
