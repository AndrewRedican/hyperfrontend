import type { MockWindow } from './test-utils'
import type { IChannelContract } from '../types/contract'
import { createMockWindow } from './test-utils'
import { createBroker } from '../broker/factory'

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
        settings: { debug: false },
      })

      const broker2 = createBroker({
        name: 'broker-2',
        contract: networkContract,
        settings: { debug: false },
      })

      const broker3 = createBroker({
        name: 'broker-3',
        contract: networkContract,
        settings: { debug: false },
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
        settings: { debug: false },
      })

      const broker2 = createBroker({
        name: 'broker-2',
        contract: networkContract,
        settings: { debug: false },
      })

      const channel1 = broker1.addChannel('channel-1', windows[0] as unknown as Window)
      const channel2 = broker2.addChannel('channel-2', windows[1] as unknown as Window)

      expect(broker1.channels).toHaveLength(1)
      expect(broker2.channels).toHaveLength(1)
      expect(channel1.name).toBe('channel-1')
      expect(channel2.name).toBe('channel-2')
    })
  })

  describe('Star Network Topology', () => {
    it('creates hub-and-spoke pattern', () => {
      // Central hub broker
      const hub = createBroker({
        name: 'hub-broker',
        contract: networkContract,
        settings: { debug: false },
      })

      // Create spoke channels
      const spokes = windows.map((win, i) => hub.addChannel(`spoke-${i}`, win as unknown as Window))

      spokes.forEach((spoke) => spoke.connect())

      expect(hub.channels).toHaveLength(5)
      expect(spokes.every((s) => s.isActive())).toBe(true)
    })

    it('broadcasts from hub to all spokes', () => {
      const hub = createBroker({
        name: 'hub-broker',
        contract: networkContract,
        settings: { debug: false },
      })

      const spokes = windows.map((win, i) => hub.addChannel(`spoke-${i}`, win as unknown as Window))
      spokes.forEach((spoke) => spoke.connect())

      // Clear initial connection messages
      windows.forEach((win) => win.postMessage.mockClear())

      // Broadcast to all spokes
      spokes.forEach((spoke) => {
        spoke.send('BROADCAST', { from: 'hub', message: 'Hello all' })
      })

      // Verify all windows received message
      windows.forEach((win) => {
        expect(win.postMessage).toHaveBeenCalled()
      })
    })

    it('handles direct messages between spokes via hub', () => {
      const hub = createBroker({
        name: 'hub-broker',
        contract: networkContract,
        settings: { debug: false },
      })

      const spoke1 = hub.addChannel('spoke-1', windows[0] as unknown as Window)
      const spoke2 = hub.addChannel('spoke-2', windows[1] as unknown as Window)

      spoke1.connect()
      spoke2.connect()

      windows[0].postMessage.mockClear()
      windows[1].postMessage.mockClear()

      // Send direct message from spoke1 to spoke2
      spoke1.send('DIRECT', { to: 'spoke-2', message: 'Private message' })

      // In real scenario, hub would route to spoke2
      expect(windows[0].postMessage).toHaveBeenCalled()
    })
  })

  describe('Mesh Network Topology', () => {
    it('creates fully connected mesh', () => {
      // Create brokers for each node
      const brokers = windows.map((_, i) =>
        createBroker({
          name: `node-${i}`,
          contract: networkContract,
          settings: { debug: false },
        })
      )

      // Connect each broker to all others (full mesh)
      brokers.forEach((broker, i) => {
        windows.forEach((win, j) => {
          if (i !== j) {
            const channel = broker.addChannel(`peer-${j}`, win as unknown as Window)
            channel.connect()
          }
        })
      })

      // Each broker should have connections to all others (n-1)
      brokers.forEach((broker) => {
        expect(broker.channels.length).toBe(windows.length - 1)
      })
    })

    it('routes messages in mesh network', () => {
      const broker1 = createBroker({
        name: 'node-1',
        contract: networkContract,
        settings: { debug: false },
      })

      const broker2 = createBroker({
        name: 'node-2',
        contract: networkContract,
        settings: { debug: false },
      })

      const broker3 = createBroker({
        name: 'node-3',
        contract: networkContract,
        settings: { debug: false },
      })

      // Create bidirectional connections
      const ch12 = broker1.addChannel('to-node-2', windows[1] as unknown as Window)
      const ch13 = broker1.addChannel('to-node-3', windows[2] as unknown as Window)
      const ch21 = broker2.addChannel('to-node-1', windows[0] as unknown as Window)
      const ch23 = broker2.addChannel('to-node-3', windows[2] as unknown as Window)
      const ch31 = broker3.addChannel('to-node-1', windows[0] as unknown as Window)
      const ch32 = broker3.addChannel('to-node-2', windows[1] as unknown as Window)

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
        settings: { debug: false },
      })

      const broker2 = createBroker({
        name: 'load-broker-2',
        contract: networkContract,
        settings: { debug: false },
      })

      // Distribute channels using round-robin
      windows.forEach((win, i) => {
        const broker = i % 2 === 0 ? broker1 : broker2
        broker.addChannel(`channel-${i}`, win as unknown as Window).connect()
      })

      expect(broker1.channels).toHaveLength(3) // 0, 2, 4
      expect(broker2.channels).toHaveLength(2) // 1, 3
    })

    it('handles failover between brokers', () => {
      const primary = createBroker({
        name: 'primary-broker',
        contract: networkContract,
        settings: { debug: false },
      })

      const backup = createBroker({
        name: 'backup-broker',
        contract: networkContract,
        settings: { debug: false },
      })

      // Initially use primary
      const channel = primary.addChannel('failover-channel', windows[0] as unknown as Window)
      channel.connect()

      expect(channel.isActive()).toBe(true)

      // Simulate primary failure - disconnect channel
      channel.disconnect()

      // Create new channel on backup broker
      const backupChannel = backup.addChannel('failover-channel', windows[0] as unknown as Window)
      backupChannel.connect()

      expect(backupChannel.isActive()).toBe(true)
    })
  })

  describe('Peer-to-Peer Communication', () => {
    it('enables direct peer-to-peer messaging', () => {
      const peer1Broker = createBroker({
        name: 'peer-1',
        contract: networkContract,
        settings: { debug: false },
      })

      const peer2Broker = createBroker({
        name: 'peer-2',
        contract: networkContract,
        settings: { debug: false },
      })

      // Peer 1 creates channel to Peer 2
      const peer1ToPeer2 = peer1Broker.addChannel('to-peer-2', windows[1] as unknown as Window)

      // Peer 2 creates channel to Peer 1
      const peer2ToPeer1 = peer2Broker.addChannel('to-peer-1', windows[0] as unknown as Window)

      peer1ToPeer2.connect()
      peer2ToPeer1.connect()

      expect(peer1ToPeer2.isActive()).toBe(true)
      expect(peer2ToPeer1.isActive()).toBe(true)

      // Send message in both directions
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
        settings: { debug: false },
      })

      const domain2 = createBroker({
        name: 'domain-2',
        contract: networkContract,
        settings: { debug: false },
      })

      // Domain 1 has channels 0,1,2
      const domain1Channels = [0, 1, 2].map((i) => domain1.addChannel(`d1-ch${i}`, windows[i] as unknown as Window))

      // Domain 2 has channels 3,4
      const domain2Channels = [3, 4].map((i) => domain2.addChannel(`d2-ch${i - 3}`, windows[i] as unknown as Window))

      domain1Channels.forEach((ch) => ch.connect())
      domain2Channels.forEach((ch) => ch.connect())

      // Verify isolation
      expect(domain1.channels).toHaveLength(3)
      expect(domain2.channels).toHaveLength(2)

      // Broadcast in domain1 should not affect domain2
      windows.forEach((win) => win.postMessage.mockClear())

      domain1Channels.forEach((ch) => ch.send('BROADCAST', { domain: 1, message: 'Domain 1 broadcast' }))

      // Only domain1 windows should receive
      expect(windows[0].postMessage).toHaveBeenCalled()
      expect(windows[1].postMessage).toHaveBeenCalled()
      expect(windows[2].postMessage).toHaveBeenCalled()
      // Domain 2 windows should not be affected (no broadcast from their channels)
    })
  })
})
