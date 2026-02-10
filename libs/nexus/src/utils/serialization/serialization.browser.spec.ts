import { channelToJSON } from './channel-to-json'
import { brokerToJSON } from './broker-to-json'
import { createBroker } from '../../broker/factory'
import { type IChannelContract } from '../../types/contract'

describe('Serialization Utilities', () => {
  describe('channelToJSON', () => {
    let mockWindow: Window

    beforeEach(() => {
      mockWindow = <Window>(<unknown>{
        postMessage: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })
    })

    it('serializes channel to JSON', () => {
      const broker = createBroker({
        name: 'broker-123',
        contract: {
          accepted: [{ type: 'message' }],
          emitted: [{ type: 'response' }],
        },
      })

      const channel = broker.addChannel('test-channel', mockWindow)

      const json = channelToJSON(channel)

      expect(json).toBeDefined()
      expect(json.id).toBeDefined()
      expect(json.name).toBe('test-channel')
      expect(json.active).toBe(false)
    })

    it('serializes active channel', () => {
      const broker = createBroker({
        name: 'broker-123',
        contract: {
          accepted: [{ type: 'test' }],
          emitted: [{ type: 'result' }],
        },
      })

      const channel = broker.addChannel('active-channel', mockWindow)

      // Connect the channel to make it active
      channel.connect()

      const json = channelToJSON(channel)

      expect(json.name).toBe('active-channel')
      expect(json.active).toBe(true) // Broker-managed channels become active immediately
    })

    it('calls channel toJSON method', () => {
      const broker = createBroker({
        name: 'broker-123',
        contract: { accepted: [{ type: 'test' }], emitted: [{ type: 'response' }] },
      })

      const channel = broker.addChannel('test', mockWindow)

      const toJSONSpy = jest.spyOn(channel, 'toJSON')

      channelToJSON(channel)

      expect(toJSONSpy).toHaveBeenCalled()

      toJSONSpy.mockRestore()
    })

    it('serializes channel with queued messages', () => {
      const broker = createBroker({
        name: 'broker-123',
        contract: { accepted: [{ type: 'test' }], emitted: [{ type: 'response' }] },
      })

      const channel = broker.addChannel('test', mockWindow)

      const json = channelToJSON(channel)

      expect(json).toBeDefined()
      expect(json.name).toBe('test')
    })

    it('handles multiple channels', () => {
      const broker1 = createBroker({
        name: 'broker-1',
        contract: { accepted: [{ type: 'test' }], emitted: [{ type: 'response' }] },
      })

      const broker2 = createBroker({
        name: 'broker-2',
        contract: { accepted: [{ type: 'test' }], emitted: [{ type: 'response' }] },
      })

      const channels = [broker1.addChannel('channel-1', mockWindow), broker2.addChannel('channel-2', mockWindow)]

      const jsonArray = channels.map(channelToJSON)

      expect(jsonArray).toHaveLength(2)
      expect(jsonArray[0].name).toBe('channel-1')
      expect(jsonArray[1].name).toBe('channel-2')
    })
  })

  describe('brokerToJSON', () => {
    const defaultContract: IChannelContract = {
      accepted: [{ type: 'test' }],
      emitted: [{ type: 'response' }],
    }

    let mockWindow: Window

    beforeEach(() => {
      mockWindow = <Window>(<unknown>{
        postMessage: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })
    })

    it('serializes broker to JSON', () => {
      const broker = createBroker({
        name: 'test-broker',
        contract: defaultContract,
      })

      const json = brokerToJSON(broker)

      expect(json).toBeDefined()
      expect(json.id).toBeDefined()
      expect(json.name).toBe('test-broker')
      expect(json.channels).toEqual([])
    })

    it('serializes broker with channels', () => {
      const broker = createBroker({
        name: 'broker-with-channels',
        contract: defaultContract,
      })

      // Create separate mock windows for each channel
      const mockWindow1 = <Window>(<unknown>{
        postMessage: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })

      const mockWindow2 = <Window>(<unknown>{
        postMessage: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })

      // Add channels
      broker.addChannel('channel-1', mockWindow1)
      broker.addChannel('channel-2', mockWindow2)

      const json = brokerToJSON(broker)

      expect(json.name).toBe('broker-with-channels')
      expect(json.channels).toHaveLength(2)
      expect(json.channels[0].name).toBe('channel-1')
      expect(json.channels[1].name).toBe('channel-2')
    })

    it('includes channel details in serialization', () => {
      const broker = createBroker({
        name: 'detailed-broker',
        contract: defaultContract,
      })

      broker.addChannel('my-channel', mockWindow)

      const json = brokerToJSON(broker)

      expect(json.channels).toHaveLength(1)
      expect(json.channels[0]).toHaveProperty('id')
      expect(json.channels[0]).toHaveProperty('name')
      expect(json.channels[0]).toHaveProperty('active')
    })

    it('uses broker methods for serialization', () => {
      const broker = createBroker({ name: 'test', contract: defaultContract })

      const json = brokerToJSON(broker)

      expect(json.id).toBe(broker.id)
      expect(json.name).toBe(broker.name)
      expect(json.channels).toEqual(broker.channels)
    })

    it('handles empty broker', () => {
      const broker = createBroker({ name: 'empty-broker', contract: defaultContract })

      const json = brokerToJSON(broker)

      expect(json.channels).toEqual([])
    })

    it('serializes multiple brokers independently', () => {
      const broker1 = createBroker({ name: 'broker-1', contract: defaultContract })
      const broker2 = createBroker({ name: 'broker-2', contract: defaultContract })

      const mockWindow1 = <Window>(<unknown>{
        postMessage: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })

      const mockWindow2 = <Window>(<unknown>{
        postMessage: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })

      const mockWindow3 = <Window>(<unknown>{
        postMessage: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })

      broker1.addChannel('channel-1', mockWindow1)
      broker2.addChannel('channel-2', mockWindow2)
      broker2.addChannel('channel-3', mockWindow3)

      const json1 = brokerToJSON(broker1)
      const json2 = brokerToJSON(broker2)

      expect(json1.name).toBe('broker-1')
      expect(json1.channels).toHaveLength(1)

      expect(json2.name).toBe('broker-2')
      expect(json2.channels).toHaveLength(2)
    })
  })

  describe('Integration', () => {
    const defaultContract: IChannelContract = {
      accepted: [{ type: 'test' }],
      emitted: [{ type: 'response' }],
    }

    let mockWindow: Window

    beforeEach(() => {
      mockWindow = <Window>(<unknown>{
        postMessage: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })
    })

    it('serializes full broker structure', () => {
      const broker = createBroker({
        name: 'integration-broker',
        contract: defaultContract,
      })

      const mockWindow1 = <Window>(<unknown>{
        postMessage: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })

      const mockWindow2 = <Window>(<unknown>{
        postMessage: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })

      const mockWindow3 = <Window>(<unknown>{
        postMessage: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      })

      broker.addChannel('channel-1', mockWindow1)
      broker.addChannel('channel-2', mockWindow2)
      broker.addChannel('channel-3', mockWindow3)

      const json = brokerToJSON(broker)

      expect(json).toMatchObject({
        id: expect.any(String),
        name: 'integration-broker',
        channels: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: 'channel-1',
            active: expect.any(Boolean),
          }),
          expect.objectContaining({
            id: expect.any(String),
            name: 'channel-2',
            active: expect.any(Boolean),
          }),
          expect.objectContaining({
            id: expect.any(String),
            name: 'channel-3',
            active: expect.any(Boolean),
          }),
        ]),
      })
    })

    it('produces JSON-serializable output', () => {
      const broker = createBroker({ name: 'json-test', contract: defaultContract })
      broker.addChannel('test-channel', mockWindow)

      const json = brokerToJSON(broker)

      // Should be able to stringify without errors
      expect(() => JSON.stringify(json)).not.toThrow()

      // Should be able to parse back
      const stringified = JSON.stringify(json)
      const parsed = JSON.parse(stringified)

      expect(parsed.name).toBe('json-test')
      expect(parsed.channels).toHaveLength(1)
    })

    it('does not include functions in serialized output', () => {
      const broker = createBroker({ name: 'method-test', contract: defaultContract })
      const json = brokerToJSON(broker)

      const stringified = JSON.stringify(json)

      // Functions should not appear in stringified JSON
      expect(stringified).not.toContain('function')
      expect(stringified).not.toContain('addChannel')
      expect(stringified).not.toContain('removeChannel')
    })
  })
})
