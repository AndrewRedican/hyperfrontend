import type { ChannelJSON } from '../../types/channel'
import type { IMessage } from '../../types/message'
import type { MessageHandler, MessagePredicate } from './create'
import { byType } from './by-type'
import { compose } from './compose'
import { create } from './create'

describe('Message Filters', () => {
  let mockChannel: ChannelJSON

  beforeEach(() => {
    mockChannel = {
      id: 'test-channel',
      name: 'Test Channel',
      origin: 'http://example.com',
      active: true,
      connectTimestamp: Date.now(),
      contract: { accepted: [], emitted: [] },
      peerContract: null,
      peerId: null,
      queuedMessagesCount: 0,
    }
  })

  describe('create', () => {
    it('creates a filter with custom predicate', () => {
      const handler = jest.fn()
      const predicate: MessagePredicate = (msg) => msg.type === 'test'
      const filteredHandler = create(predicate)(handler)

      const message: IMessage = { type: 'test', data: 'payload' }

      filteredHandler(message, mockChannel)
      expect(handler).toHaveBeenCalledWith(message, mockChannel)
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('does not call handler when predicate returns false', () => {
      const handler = jest.fn()
      const predicate: MessagePredicate = (msg) => msg.type === 'allowed'
      const filteredHandler = create(predicate)(handler)

      const message: IMessage = { type: 'blocked', data: 'payload' }

      filteredHandler(message, mockChannel)
      expect(handler).not.toHaveBeenCalled()
    })

    it('workss with complex predicates', () => {
      const handler = jest.fn()
      const predicate: MessagePredicate = (msg) => {
        return msg.type.startsWith('user') && typeof msg.data === 'object'
      }
      const filteredHandler = create(predicate)(handler)

      filteredHandler({ type: 'user-login', data: { id: 1 } }, mockChannel)
      expect(handler).toHaveBeenCalledTimes(1)

      filteredHandler({ type: 'admin-login', data: { id: 1 } }, mockChannel)
      expect(handler).toHaveBeenCalledTimes(1)

      filteredHandler({ type: 'user-logout', data: 'string' }, mockChannel)
      expect(handler).toHaveBeenCalledTimes(1)

      filteredHandler({ type: 'user-update', data: { name: 'test' } }, mockChannel)
      expect(handler).toHaveBeenCalledTimes(2)
    })
  })

  describe('byType', () => {
    it('filters messages by type', () => {
      const handler = jest.fn()
      const filteredHandler = byType('user-login')(handler)

      const message: IMessage = { type: 'user-login', data: { userId: 123 } }

      filteredHandler(message, mockChannel)
      expect(handler).toHaveBeenCalledWith(message, mockChannel)
    })

    it('does not call handler for different message types', () => {
      const handler = jest.fn()
      const filteredHandler = byType('user-login')(handler)

      filteredHandler({ type: 'user-logout' }, mockChannel)
      filteredHandler({ type: 'admin-login' }, mockChannel)
      filteredHandler({ type: 'data-update' }, mockChannel)

      expect(handler).not.toHaveBeenCalled()
    })

    it('is case-sensitive', () => {
      const handler = jest.fn()
      const filteredHandler = byType('UserLogin')(handler)

      filteredHandler({ type: 'userlogin' }, mockChannel)
      filteredHandler({ type: 'USERLOGIN' }, mockChannel)
      filteredHandler({ type: 'UserLogin' }, mockChannel)

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('compose', () => {
    it('composess multiple filters', () => {
      const handler = jest.fn()

      const userFilter = byType('user')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adminFilter = create<IMessage>((msg) => (<any>msg.data)?.admin === true)

      const composedHandler = compose(adminFilter, userFilter)(handler)

      composedHandler({ type: 'user', data: { admin: true } }, mockChannel)
      expect(handler).toHaveBeenCalledTimes(1)

      composedHandler({ type: 'guest', data: { admin: true } }, mockChannel)
      expect(handler).toHaveBeenCalledTimes(1)

      composedHandler({ type: 'user', data: { admin: false } }, mockChannel)
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('applies filters right-to-left', () => {
      const handler = jest.fn()
      const executionOrder: string[] = []

      const filter1 = (h: MessageHandler) => (msg: IMessage, ch: ChannelJSON) => {
        executionOrder.push('filter1')
        h(msg, ch)
      }

      const filter2 = (h: MessageHandler) => (msg: IMessage, ch: ChannelJSON) => {
        executionOrder.push('filter2')
        h(msg, ch)
      }

      const filter3 = (h: MessageHandler) => (msg: IMessage, ch: ChannelJSON) => {
        executionOrder.push('filter3')
        h(msg, ch)
      }

      const composedHandler = compose(filter1, filter2, filter3)(handler)

      composedHandler({ type: 'test' }, mockChannel)

      expect(executionOrder).toEqual(['filter3', 'filter2', 'filter1'])
    })

    it('workss with empty filter list', () => {
      const handler = jest.fn()
      const composedHandler = compose()(handler)

      const message: IMessage = { type: 'test' }

      composedHandler(message, mockChannel)
      expect(handler).toHaveBeenCalledWith(message, mockChannel)
    })

    it('workss with single filter', () => {
      const handler = jest.fn()
      const singleFilter = byType('test')
      const composedHandler = compose(singleFilter)(handler)

      composedHandler({ type: 'test' }, mockChannel)
      expect(handler).toHaveBeenCalledTimes(1)

      composedHandler({ type: 'other' }, mockChannel)
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('handless complex composition', () => {
      const handler = jest.fn()

      const typeFilter = byType('data-update')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const priorityFilter = create<IMessage>((msg) => (<any>msg.data)?.priority === 'high')
      const validDataFilter = create<IMessage>((msg) => msg.data !== undefined)

      const composedHandler = compose(typeFilter, priorityFilter, validDataFilter)(handler)

      composedHandler(
        {
          type: 'data-update',
          data: { priority: 'high', value: 100 },
        },
        mockChannel
      )
      expect(handler).toHaveBeenCalledTimes(1)

      composedHandler({ type: 'data-update' }, mockChannel)
      expect(handler).toHaveBeenCalledTimes(1)

      composedHandler(
        {
          type: 'data-update',
          data: { priority: 'low', value: 100 },
        },
        mockChannel
      )
      expect(handler).toHaveBeenCalledTimes(1)

      composedHandler(
        {
          type: 'user-update',
          data: { priority: 'high', value: 100 },
        },
        mockChannel
      )
      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('Integration - Real-world scenarios', () => {
    it('handless authentication messages', () => {
      const loginHandler = jest.fn()
      const logoutHandler = jest.fn()

      const loginFilter = byType('user-login')
      const logoutFilter = byType('user-logout')

      const filteredLogin = loginFilter(loginHandler)
      const filteredLogout = logoutFilter(logoutHandler)

      const messages: IMessage[] = [
        { type: 'user-login', data: { userId: 1 } },
        { type: 'data-update', data: { id: 1 } },
        { type: 'user-logout', data: { userId: 1 } },
        { type: 'user-login', data: { userId: 2 } },
      ]

      messages.forEach((msg) => {
        filteredLogin(msg, mockChannel)
        filteredLogout(msg, mockChannel)
      })

      expect(loginHandler).toHaveBeenCalledTimes(2)
      expect(logoutHandler).toHaveBeenCalledTimes(1)
    })

    it('handless role-based message routing', () => {
      const adminHandler = jest.fn()
      const userHandler = jest.fn()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adminFilter = create<IMessage>((msg) => (<any>msg.data)?.role === 'admin')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const userFilter = create<IMessage>((msg) => (<any>msg.data)?.role === 'user')

      const filteredAdmin = adminFilter(adminHandler)
      const filteredUser = userFilter(userHandler)

      const messages: IMessage[] = [
        { type: 'action', data: { role: 'admin', action: 'delete' } },
        { type: 'action', data: { role: 'user', action: 'view' } },
        { type: 'action', data: { role: 'guest', action: 'view' } },
        { type: 'action', data: { role: 'admin', action: 'create' } },
      ]

      messages.forEach((msg) => {
        filteredAdmin(msg, mockChannel)
        filteredUser(msg, mockChannel)
      })

      expect(adminHandler).toHaveBeenCalledTimes(2)
      expect(userHandler).toHaveBeenCalledTimes(1)
    })
  })
})
