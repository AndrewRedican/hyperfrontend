import type { IChannelContract } from '../types/contract'
import type { MockWindow } from './test-utils'
import { createBroker } from '../broker/factory'
import { createMockWindow } from './test-utils'

describe('Integration: Many-to-Many', () => {
  let windows: MockWindow[]

  beforeEach(() => {
    windows = Array.from({ length: 5 }, () => createMockWindow())
  })

  const networkContract: IChannelContract = {
    emitted: [
      { type: 'BROADCAST', description: 'Broadcast to all' },
      { type: 'DIRECT', description: 'Direct message' },
      { type: 'REQUEST', description: 'Request data' },
    ],
    accepted: [
      { type: 'BROADCAST', description: 'Receive broadcast' },
      { type: 'DIRECT', description: 'Receive direct message' },
      { type: 'RESPONSE', description: 'Response to request' },
    ],
  }

  describe('Multiple Brokers Communication', () => {
    it('creates multiple independent brokers', () => {
      const broker1 = createBroker({
        name: 'broker-1',
        contract: networkContract,
        settings: { logLevel: 'error' },
      })

      const broker2 = createBroker({
        name: 'broker-2',
        contract: networkContract,
        settings: { logLevel: 'error' },
      })

      const broker3 = createBroker({
        name: 'broker-3',
        contract: networkContract,
        settings: { logLevel: 'error' },
      })

      expect(broker1.id).not.toBe(broker2.id)
      expect(broker2.id).not.toBe(broker3.id)
      expect(broker1.name).toBe('broker-1')
      expect(broker2.name).toBe('broker-2')
      expect(broker3.name).toBe('broker-3')
    })

    it('isolates channels between brokers', () => {
      const broker1 = createBroker({
        name: 'broker-1',
        contract: networkContract,
        settings: { logLevel: 'error' },
      })

      const broker2 = createBroker({
        name: 'broker-2',
        contract: networkContract,
        settings: { logLevel: 'error' },
      })

      const channel1 = broker1.addChannel('channel-1', <Window>(<unknown>windows[0]))
      const channel2 = broker2.addChannel('channel-2', <Window>(<unknown>windows[1]))

      expect(broker1.channels).toHaveLength(1)
      expect(broker2.channels).toHaveLength(1)
      expect(channel1.name).toBe('channel-1')
      expect(channel2.name).toBe('channel-2')
    })
  })

  describe('Star Network Topology', () => {
    it('creates hub-and-spoke pattern', () => {
      const hub = createBroker({
        name: 'hub-broker',
        contract: networkContract,
        settings: { logLevel: 'error' },
      })

      const spokes = windows.map((win, i) => hub.addChannel(`spoke-${i}`, <Window>(<unknown>win)))

      spokes.forEach((spoke) => spoke.connect())

      expect(hub.channels).toHaveLength(5)
      expect(spokes.every((s) => s.isActive())).toBe(true)
    })

    it('broadcasts from hub to all spokes', () => {
      const hub = createBroker({
        name: 'hub-broker',
        contract: networkContract,
        settings: { logLevel: 'error' },
      })

      const spokes = windows.map((win, i) => hub.addChannel(`spoke-${i}`, <Window>(<unknown>win)))
      spokes.forEach((spoke) => spoke.connect())

      windows.forEach((win) => win.postMessage.mockClear())

      spokes.forEach((spoke) => {
        spoke.send('BROADCAST', { from: 'hub', message: 'Hello all' })
      })

      windows.forEach((win) => {
        expect(win.postMessage).toHaveBeenCalled()
      })
    })

    it('handles direct messages between spokes via hub', () => {
      const hub = createBroker({
        name: 'hub-broker',
        contract: networkContract,
        settings: { logLevel: 'error' },
      })

      const spoke1 = hub.addChannel('spoke-1', <Window>(<unknown>windows[0]))
      const spoke2 = hub.addChannel('spoke-2', <Window>(<unknown>windows[1]))

      spoke1.connect()
      spoke2.connect()

      windows[0].postMessage.mockClear()
      windows[1].postMessage.mockClear()

      spoke1.send('DIRECT', { to: 'spoke-2', message: 'Private message' })

      expect(windows[0].postMessage).toHaveBeenCalled()
    })
  })

  describe('Mesh Network Topology', () => {
    it('creates fully connected mesh', () => {
      const brokers = windows.map((_, i) =>
        createBroker({
          name: `node-${i}`,
          contract: networkContract,
          settings: { logLevel: 'error' },
        })
      )

      brokers.forEach((broker, i) => {
        windows.forEach((win, j) => {
          if (i !== j) {
            const channel = broker.addChannel(`peer-${j}`, <Window>(<unknown>win))
            channel.connect()
          }
        })
      })

      brokers.forEach((broker) => {
        expect(broker.channels.length).toBe(windows.length - 1)
      })
    })

    it('routes messages in mesh network', () => {
      const broker1 = createBroker({
        name: 'node-1',
        contract: networkContract,
        settings: { logLevel: 'error' },
      })

      const broker2 = createBroker({
        name: 'node-2',
        contract: networkContract,
        settings: { logLevel: 'error' },
      })

      const broker3 = createBroker({
        name: 'node-3',
        contract: networkContract,
        settings: { logLevel: 'error' },
      })

      const ch12 = broker1.addChannel('to-node-2', <Window>(<unknown>windows[1]))
      const ch13 = broker1.addChannel('to-node-3', <Window>(<unknown>windows[2]))
      const ch21 = broker2.addChannel('to-node-1', <Window>(<unknown>windows[0]))
      const ch23 = broker2.addChannel('to-node-3', <Window>(<unknown>windows[2]))
      const ch31 = broker3.addChannel('to-node-1', <Window>(<unknown>windows[0]))
      const ch32 = broker3.addChannel('to-node-2', <Window>(<unknown>windows[1]))

      ;[ch12, ch13, ch21, ch23, ch31, ch32].forEach((ch) => ch.connect())

      expect(broker1.channels).toHaveLength(2)
      expect(broker2.channels).toHaveLength(2)
      expect(broker3.channels).toHaveLength(2)
    })
  })

  describe('Load Balancing Scenarios', () => {
    it('distributes channels across multiple brokers', () => {
      const broker1 = createBroker({
        name: 'load-broker-1',
        contract: networkContract,
        settings: { logLevel: 'error' },
      })

      const broker2 = createBroker({
        name: 'load-broker-2',
        contract: networkContract,
        settings: { logLevel: 'error' },
      })

      windows.forEach((win, i) => {
        const broker = i % 2 === 0 ? broker1 : broker2
        broker.addChannel(`channel-${i}`, <Window>(<unknown>win)).connect()
      })

      expect(broker1.channels).toHaveLength(3)
      expect(broker2.channels).toHaveLength(2)
    })

    it('handles failover between brokers', () => {
      const primary = createBroker({
        name: 'primary-broker',
        contract: networkContract,
        settings: { logLevel: 'error' },
      })

      const backup = createBroker({
        name: 'backup-broker',
        contract: networkContract,
        settings: { logLevel: 'error' },
      })

      const channel = primary.addChannel('failover-channel', <Window>(<unknown>windows[0]))
      channel.connect()

      expect(channel.isActive()).toBe(true)

      channel.disconnect()

      const backupChannel = backup.addChannel('failover-channel', <Window>(<unknown>windows[0]))
      backupChannel.connect()

      expect(backupChannel.isActive()).toBe(true)
    })
  })

  describe('Peer-to-Peer Communication', () => {
    it('enables direct peer-to-peer messaging', () => {
      const peer1Broker = createBroker({
        name: 'peer-1',
        contract: networkContract,
        settings: { logLevel: 'error' },
      })

      const peer2Broker = createBroker({
        name: 'peer-2',
        contract: networkContract,
        settings: { logLevel: 'error' },
      })

      const peer1ToPeer2 = peer1Broker.addChannel('to-peer-2', <Window>(<unknown>windows[1]))

      const peer2ToPeer1 = peer2Broker.addChannel('to-peer-1', <Window>(<unknown>windows[0]))

      peer1ToPeer2.connect()
      peer2ToPeer1.connect()

      expect(peer1ToPeer2.isActive()).toBe(true)
      expect(peer2ToPeer1.isActive()).toBe(true)

      windows[0].postMessage.mockClear()
      windows[1].postMessage.mockClear()

      peer1ToPeer2.send('DIRECT', { message: 'Hello from Peer 1' })
      peer2ToPeer1.send('DIRECT', { message: 'Hello from Peer 2' })

      expect(windows[1].postMessage).toHaveBeenCalled()
      expect(windows[0].postMessage).toHaveBeenCalled()
    })
  })

  describe('Broadcast Domains', () => {
    it('creates isolated broadcast domains', () => {
      const domain1 = createBroker({
        name: 'domain-1',
        contract: networkContract,
        settings: { logLevel: 'error' },
      })

      const domain2 = createBroker({
        name: 'domain-2',
        contract: networkContract,
        settings: { logLevel: 'error' },
      })

      const domain1Channels = [0, 1, 2].map((i) => domain1.addChannel(`d1-ch${i}`, <Window>(<unknown>windows[i])))

      const domain2Channels = [3, 4].map((i) => domain2.addChannel(`d2-ch${i - 3}`, <Window>(<unknown>windows[i])))

      domain1Channels.forEach((ch) => ch.connect())
      domain2Channels.forEach((ch) => ch.connect())

      expect(domain1.channels).toHaveLength(3)
      expect(domain2.channels).toHaveLength(2)

      windows.forEach((win) => win.postMessage.mockClear())

      domain1Channels.forEach((ch) => ch.send('BROADCAST', { domain: 1, message: 'Domain 1 broadcast' }))

      expect(windows[0].postMessage).toHaveBeenCalled()
      expect(windows[1].postMessage).toHaveBeenCalled()
      expect(windows[2].postMessage).toHaveBeenCalled()
    })
  })
})
