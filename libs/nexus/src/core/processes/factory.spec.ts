import { createProcessManager } from './factory'
jest.unmock('@hyperfrontend/immutable-api-utils/built-in-copy/object')

describe('createProcessManager', () => {
  let processManager: ReturnType<typeof createProcessManager>

  beforeEach(() => {
    processManager = createProcessManager()
  })

  describe('create', () => {
    it('generates a process ID', () => {
      const channel = { id: 'test-channel' }

      const processId = processManager.create(channel)

      expect(typeof processId).toBe('string')
      expect(processId).toBeTruthy()
    })

    it('registers the channel with the process ID', () => {
      const channel = { id: 'test-channel' }
      const processId = processManager.create(channel)

      const retrieved = processManager.get(processId)
      expect(retrieved).toBe(channel)
    })
  })

  describe('get', () => {
    it('return channel for valid process ID', () => {
      const channel = { id: 'test-channel' }
      const processId = processManager.create(channel)

      const retrieved = processManager.get(processId)
      expect(retrieved).toBe(channel)
    })

    it('return undefined for unknown process ID', () => {
      const result = processManager.get('non-existent-process-id')
      expect(result).toBeUndefined()
    })
  })

  describe('remove', () => {
    it('removes process ID mapping', () => {
      const channel = { id: 'test-channel' }
      const processId = processManager.create(channel)

      expect(processManager.get(processId)).toBe(channel)

      processManager.remove(processId)

      expect(processManager.get(processId)).toBeUndefined()
    })

    it('does not throw when removing non-existent process ID', () => {
      expect(() => {
        processManager.remove('non-existent-id')
      }).not.toThrow()
    })
  })

  describe('clear', () => {
    it('removes all process mappings', () => {
      const channels = [{ id: 'channel-1' }, { id: 'channel-2' }, { id: 'channel-3' }]

      const processIds = channels.map((ch) => processManager.create(ch))

      processManager.clear()

      processIds.forEach((processId) => {
        expect(processManager.get(processId)).toBeUndefined()
      })
    })

    it('does not throw when clearing empty process manager', () => {
      expect(() => {
        processManager.clear()
      }).not.toThrow()
    })
  })

  describe('immutability', () => {
    it('return a frozen process manager object', () => {
      expect(Object.isFrozen(processManager)).toBe(true)
    })
  })

  describe('isolation', () => {
    it('creates independent process managers', () => {
      const manager1 = createProcessManager()
      const manager2 = createProcessManager()

      const channel1 = { id: 'channel-1' }
      const channel2 = { id: 'channel-2' }

      const processId1 = manager1.create(channel1)
      const processId2 = manager2.create(channel2)

      expect(manager1.get(processId1)).toBe(channel1)
      expect(manager2.get(processId2)).toBe(channel2)

      manager1.clear()
      expect(manager1.get(processId1)).toBeUndefined()
      expect(manager2.get(processId2)).toBe(channel2)
    })
  })

  describe('track', () => {
    it('associates an existing process ID with a channel', () => {
      const channel = { id: 'test-channel' }
      const processId = 'external-process-id-123'

      processManager.track(processId, channel)

      expect(processManager.get(processId)).toBe(channel)
    })

    it('overwrites existing mapping when tracking same process ID', () => {
      const channel1 = { id: 'channel-1' }
      const channel2 = { id: 'channel-2' }
      const processId = 'shared-process-id'

      processManager.track(processId, channel1)
      expect(processManager.get(processId)).toBe(channel1)

      processManager.track(processId, channel2)
      expect(processManager.get(processId)).toBe(channel2)
    })

    it('can be removed after tracking', () => {
      const channel = { id: 'test-channel' }
      const processId = 'tracked-process-id'

      processManager.track(processId, channel)
      processManager.remove(processId)

      expect(processManager.get(processId)).toBeUndefined()
    })
  })

  describe('has', () => {
    it('returns true for existing process ID', () => {
      const channel = { id: 'test-channel' }
      const processId = processManager.create(channel)

      expect(processManager.has(processId)).toBe(true)
    })

    it('returns false for non-existent process ID', () => {
      expect(processManager.has('non-existent-process-id')).toBe(false)
    })

    it('returns true for tracked process ID', () => {
      const channel = { id: 'test-channel' }
      const processId = 'tracked-process-id'

      processManager.track(processId, channel)

      expect(processManager.has(processId)).toBe(true)
    })

    it('returns false after process is removed', () => {
      const channel = { id: 'test-channel' }
      const processId = processManager.create(channel)

      expect(processManager.has(processId)).toBe(true)

      processManager.remove(processId)

      expect(processManager.has(processId)).toBe(false)
    })

    it('returns false after clear', () => {
      const channel = { id: 'test-channel' }
      const processId = processManager.create(channel)

      expect(processManager.has(processId)).toBe(true)

      processManager.clear()

      expect(processManager.has(processId)).toBe(false)
    })
  })
})
