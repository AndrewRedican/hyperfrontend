import type { IChannelContract } from '../types/contract'
import type { IMessage } from '../types/message'
import type { MockWindow } from './test-utils'
import { createBroker } from '../broker/factory'
import { createMockWindow, linkMockWindows, createContractPair, createTestContract } from './test-utils'

describe('Message Delivery Integration', () => {
  let windowA: MockWindow
  let windowB: MockWindow

  beforeEach(() => {
    windowA = createMockWindow()
    windowB = createMockWindow()

    linkMockWindows(windowA, windowB, 'http://host-a.com', 'http://host-b.com')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  function createConnectedPair(contractA: IChannelContract, contractB: IChannelContract) {
    const brokerA = createBroker({ name: 'broker-a', contract: contractA, window: <Window>(<unknown>windowA) })
    const channelA = brokerA.addChannel('to-b', <Window>(<unknown>windowB))

    const brokerB = createBroker({ name: 'broker-b', contract: contractB, window: <Window>(<unknown>windowB) })
    const channelB = brokerB.addChannel('to-a', <Window>(<unknown>windowA))

    channelA.connect()
    channelB.connect()

    return { channelA, channelB }
  }

  it('delivers a message from side A to the side B channel handler', () => {
    const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
    const { channelA, channelB } = createConnectedPair(contractA, contractB)

    const messagesB: IMessage[] = []
    channelB.onMessage((message) => messagesB.push(message))

    channelA.send('PING', { count: 1 })

    expect(messagesB).toEqual([expect.objectContaining({ type: 'PING', data: { count: 1 } })])
  })

  it('delivers a message from side B back to the side A channel handler', () => {
    const { contractA, contractB } = createContractPair(['PING'], ['PONG'])
    const { channelA, channelB } = createConnectedPair(contractA, contractB)

    const messagesA: IMessage[] = []
    channelA.onMessage((message) => messagesA.push(message))

    channelB.send('PONG', { reply: true })

    expect(messagesA).toEqual([expect.objectContaining({ type: 'PONG', data: { reply: true } })])
  })

  it('delivers a message without a payload', () => {
    const { contractA, contractB } = createContractPair(['BEAT'], [])
    const { channelA, channelB } = createConnectedPair(contractA, contractB)

    const messagesB: IMessage[] = []
    channelB.onMessage((message) => messagesB.push(message))

    channelA.send('BEAT')

    expect(messagesB).toEqual([expect.objectContaining({ type: 'BEAT' })])
  })

  it('drops a message whose type is not accepted by the receiving channel contract', () => {
    const contractA = createTestContract(['PING', 'ROGUE'], ['PONG'])
    const contractB = createTestContract(['PONG'], ['PING'])
    const { channelA, channelB } = createConnectedPair(contractA, contractB)

    const messagesB: IMessage[] = []
    channelB.onMessage((message) => messagesB.push(message))

    channelA.send('ROGUE', { count: 1 })

    expect(messagesB).toEqual([])
  })
})
