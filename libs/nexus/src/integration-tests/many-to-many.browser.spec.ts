import type { IChannelContract } from '../types/contract'
import type { IMessage } from '../types/message'
import type { MockWindow } from './test-utils'
import { createBroker } from '../broker/factory'
import { createMockWindow, createTestContract, linkMockWindows } from './test-utils'

describe('Integration: Many-to-Many', () => {
  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.clearAllMocks()
  })

  // why: linkMockWindows wires exactly one counterpart per window, which cannot model many senders reaching one broker window.
  // how: every nexus frame carries the sending broker id, so the network maps it back to the sender's window and origin per frame.
  // note: the receiving broker resolves channels by event.source and checks event.origin against the origin pinned at handshake.
  const createNetwork = () => {
    const peers: { win: MockWindow; origin: string; brokerId: string }[] = []

    return {
      attach(win: MockWindow, origin: string, brokerId: string): void {
        peers.push({ win, origin, brokerId })
        win.postMessage.mockImplementation((data: unknown) => {
          const sender = peers.find((peer) => peer.brokerId === (<{ senderId?: string }>data)?.senderId)
          if (!sender) {
            return
          }
          win._dispatchMessage(
            new MessageEvent('message', {
              data,
              origin: sender.origin,
              source: <Window>(<unknown>sender.win),
            })
          )
        })
      },
    }
  }

  type Network = ReturnType<typeof createNetwork>

  const createNode = (network: Network, name: string, origin: string, contract: IChannelContract) => {
    const win = createMockWindow()
    const broker = createBroker({ name, contract, window: <Window>(<unknown>win) })
    network.attach(win, origin, broker.id)
    return { win, broker }
  }

  type TestNode = ReturnType<typeof createNode>

  const connectPair = (nodeA: TestNode, nodeB: TestNode, nameAtA: string, nameAtB: string) => {
    const channelAtA = nodeA.broker.addChannel(nameAtA, <Window>(<unknown>nodeB.win))
    const channelAtB = nodeB.broker.addChannel(nameAtB, <Window>(<unknown>nodeA.win))
    channelAtA.connect()
    channelAtB.connect()
    return { channelAtA, channelAtB }
  }

  // note: a broker has one contract shared by all of its channels, so the hub must accept everything spokes emit and vice versa.
  const hubContract = createTestContract(['BROADCAST', 'DIRECT'], ['DIRECT'])
  const spokeContract = createTestContract(['DIRECT'], ['BROADCAST', 'DIRECT'])
  const peerContract = createTestContract(['BROADCAST', 'DIRECT'], ['BROADCAST', 'DIRECT'])

  const setupStar = (network: Network, domain: string, spokeCount: number) => {
    const hub = createNode(network, `${domain}-hub`, `http://${domain}-hub.com`, hubContract)
    const pairs = Array.from({ length: spokeCount }, (_, i) => {
      const spoke = createNode(network, `${domain}-spoke-${i}`, `http://${domain}-spoke-${i}.com`, spokeContract)
      const { channelAtA: hubChannel, channelAtB: spokeChannel } = connectPair(hub, spoke, `to-spoke-${i}`, 'to-hub')
      return { hubChannel, spokeChannel }
    })
    return { hub, pairs }
  }

  const setupMesh = (network: Network, size: number) => {
    const nodes = Array.from({ length: size }, (_, i) => createNode(network, `node-${i}`, `http://node-${i}.com`, peerContract))
    const pairs = nodes.flatMap((nodeA, i) =>
      nodes.slice(i + 1).map((nodeB, offset) => connectPair(nodeA, nodeB, `to-node-${i + 1 + offset}`, `to-node-${i}`))
    )
    return { nodes, pairs }
  }

  const collectSpokeInboxes = (pairs: { spokeChannel: { onMessage: (handler: (message: IMessage) => void) => () => void } }[]) =>
    pairs.map((pair) => {
      const inbox: IMessage[] = []
      pair.spokeChannel.onMessage((message) => inbox.push(message))
      return inbox
    })

  describe('Multiple Brokers Communication', () => {
    it('creates independent brokers each listening on its own window', () => {
      const network = createNetwork()
      const nodes = [1, 2, 3].map((i) => createNode(network, `broker-${i}`, `http://host-${i}.com`, peerContract))

      expect({
        distinctIds: [
          nodes[0].broker.id !== nodes[1].broker.id,
          nodes[1].broker.id !== nodes[2].broker.id,
          nodes[0].broker.id !== nodes[2].broker.id,
        ],
        names: nodes.map((node) => node.broker.name),
      }).toEqual({
        distinctIds: [true, true, true],
        names: ['broker-1', 'broker-2', 'broker-3'],
      })
    })

    it('registers channels only on the broker that created them', () => {
      const network = createNetwork()
      const nodeA = createNode(network, 'broker-a', 'http://host-a.com', peerContract)
      const nodeB = createNode(network, 'broker-b', 'http://host-b.com', peerContract)

      nodeA.broker.addChannel('channel-a', <Window>(<unknown>nodeB.win))
      nodeB.broker.addChannel('channel-b', <Window>(<unknown>nodeA.win))

      expect({
        aChannels: nodeA.broker.channels.map((channel) => channel.name),
        bChannels: nodeB.broker.channels.map((channel) => channel.name),
      }).toEqual({ aChannels: ['channel-a'], bChannels: ['channel-b'] })
    })
  })

  describe('Star Network Topology', () => {
    it('activates every hub-spoke pair through the wire handshake', () => {
      const { hub, pairs } = setupStar(createNetwork(), 'star', 3)

      expect({
        hubChannels: hub.broker.channels.length,
        pairsActive: pairs.map((pair) => pair.hubChannel.isActive() && pair.spokeChannel.isActive()),
      }).toEqual({ hubChannels: 3, pairsActive: [true, true, true] })
    })

    it('delivers a hub broadcast to every spoke', () => {
      const { pairs } = setupStar(createNetwork(), 'star', 3)
      const inboxes = collectSpokeInboxes(pairs)

      pairs.forEach((pair) => pair.hubChannel.send('BROADCAST', { from: 'hub', message: 'Hello all' }))

      expect(inboxes).toEqual(
        pairs.map(() => [expect.objectContaining({ type: 'BROADCAST', data: { from: 'hub', message: 'Hello all' } })])
      )
    })

    it('relays a direct message between spokes through the hub', () => {
      const { pairs } = setupStar(createNetwork(), 'star', 2)

      const spoke1Inbox: IMessage[] = []
      pairs[1].spokeChannel.onMessage((message) => spoke1Inbox.push(message))

      // how: relaying is hub application logic, not a broker built-in; the hub forwards spoke 0's DIRECT traffic to spoke 1.
      pairs[0].hubChannel.onMessage((message) => {
        if (message.type === 'DIRECT') {
          pairs[1].hubChannel.send('DIRECT', message.data)
        }
      })

      pairs[0].spokeChannel.send('DIRECT', { to: 'spoke-1', message: 'Private message' })

      expect(spoke1Inbox).toEqual([expect.objectContaining({ type: 'DIRECT', data: { to: 'spoke-1', message: 'Private message' } })])
    })
  })

  describe('Mesh Network Topology', () => {
    it('activates every channel pair in a fully connected mesh', () => {
      const { nodes, pairs } = setupMesh(createNetwork(), 3)

      expect({
        channelCounts: nodes.map((node) => node.broker.channels.length),
        pairsActive: pairs.map((pair) => pair.channelAtA.isActive() && pair.channelAtB.isActive()),
      }).toEqual({ channelCounts: [2, 2, 2], pairsActive: [true, true, true] })
    })

    it('delivers direct messages across handshaken mesh links', () => {
      const { pairs } = setupMesh(createNetwork(), 3)

      // note: with three nodes the pair order is 0-1, 0-2, 1-2, so index 1 holds the node-0 to node-2 link.
      const inbox: IMessage[] = []
      pairs[1].channelAtB.onMessage((message) => inbox.push(message))

      pairs[1].channelAtA.send('DIRECT', { from: 'node-0', to: 'node-2' })

      expect(inbox).toEqual([expect.objectContaining({ type: 'DIRECT', data: { from: 'node-0', to: 'node-2' } })])
    })
  })

  describe('Load Balancing Scenarios', () => {
    it('activates channels distributed across multiple brokers', () => {
      const network = createNetwork()
      const loadNode1 = createNode(network, 'load-broker-1', 'http://load-1.com', peerContract)
      const loadNode2 = createNode(network, 'load-broker-2', 'http://load-2.com', peerContract)

      const pairs = Array.from({ length: 5 }, (_, i) => {
        const peer = createNode(network, `peer-broker-${i}`, `http://peer-${i}.com`, peerContract)
        const owner = i % 2 === 0 ? loadNode1 : loadNode2
        return connectPair(owner, peer, `channel-${i}`, 'to-load-broker')
      })

      expect({
        broker1Channels: loadNode1.broker.channels.length,
        broker2Channels: loadNode2.broker.channels.length,
        allActive: pairs.every((pair) => pair.channelAtA.isActive() && pair.channelAtB.isActive()),
      }).toEqual({ broker1Channels: 3, broker2Channels: 2, allActive: true })
    })

    it('fails over to a backup broker through a fresh handshake', () => {
      const network = createNetwork()
      const primary = createNode(network, 'primary-broker', 'http://primary.com', peerContract)
      const backup = createNode(network, 'backup-broker', 'http://backup.com', peerContract)
      const peer = createNode(network, 'peer-broker', 'http://peer.com', peerContract)

      const primaryPair = connectPair(primary, peer, 'failover-channel', 'to-primary')
      primaryPair.channelAtA.disconnect()

      const backupPair = connectPair(backup, peer, 'failover-channel', 'to-backup')

      expect({
        primaryPairActive: [primaryPair.channelAtA.isActive(), primaryPair.channelAtB.isActive()],
        backupPairActive: [backupPair.channelAtA.isActive(), backupPair.channelAtB.isActive()],
      }).toEqual({ primaryPairActive: [false, false], backupPairActive: [true, true] })
    })
  })

  describe('Peer-to-Peer Communication', () => {
    it('exchanges direct messages in both directions after the handshake', () => {
      const windowA = createMockWindow()
      const windowB = createMockWindow()
      linkMockWindows(windowA, windowB, 'http://peer-1.com', 'http://peer-2.com')

      const peer1Broker = createBroker({ name: 'peer-1', contract: peerContract, window: <Window>(<unknown>windowA) })
      const peer2Broker = createBroker({ name: 'peer-2', contract: peerContract, window: <Window>(<unknown>windowB) })
      const peer1ToPeer2 = peer1Broker.addChannel('to-peer-2', <Window>(<unknown>windowB))
      const peer2ToPeer1 = peer2Broker.addChannel('to-peer-1', <Window>(<unknown>windowA))
      peer1ToPeer2.connect()
      peer2ToPeer1.connect()

      // why: send() also notifies the sender's own subscribers, so each inbox only listens while the counterpart is sending.
      const atPeer2: IMessage[] = []
      const stopPeer2 = peer2ToPeer1.onMessage((message) => atPeer2.push(message))
      peer1ToPeer2.send('DIRECT', { message: 'Hello from Peer 1' })
      stopPeer2()

      const atPeer1: IMessage[] = []
      peer1ToPeer2.onMessage((message) => atPeer1.push(message))
      peer2ToPeer1.send('DIRECT', { message: 'Hello from Peer 2' })

      expect({ atPeer1, atPeer2 }).toEqual({
        atPeer1: [expect.objectContaining({ type: 'DIRECT', data: { message: 'Hello from Peer 2' } })],
        atPeer2: [expect.objectContaining({ type: 'DIRECT', data: { message: 'Hello from Peer 1' } })],
      })
    })
  })

  describe('Broadcast Domains', () => {
    it('confines broadcasts to the spokes of their own domain', () => {
      const network = createNetwork()
      const domain1 = setupStar(network, 'domain-1', 3)
      const domain2 = setupStar(network, 'domain-2', 2)

      const domain1Inboxes = collectSpokeInboxes(domain1.pairs)
      const domain2Inboxes = collectSpokeInboxes(domain2.pairs)

      domain1.pairs.forEach((pair) => pair.hubChannel.send('BROADCAST', { domain: 1, message: 'Domain 1 broadcast' }))

      expect({ domain1Inboxes, domain2Inboxes }).toEqual({
        domain1Inboxes: domain1.pairs.map(() => [
          expect.objectContaining({ type: 'BROADCAST', data: { domain: 1, message: 'Domain 1 broadcast' } }),
        ]),
        domain2Inboxes: [[], []],
      })
    })
  })
})
