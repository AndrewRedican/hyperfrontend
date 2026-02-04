import { create, open, close, cancel, deny, invalid } from './index'
import type { ChannelEvent, OpenEventData, CloseEventData, CancelEventData, DenyEventData, InvalidEventData } from '../../types/events'
import type { ChannelJSON } from '../../types/channel'

describe('Event Filters', () => {
  let mockChannel: ChannelJSON

  beforeEach(() => {
    mockChannel = {
      id: 'test-channel',
      name: 'Test Channel',
      origin: 'http://example.com',
      active: true,
      connectTimestamp: Date.now(),
      contract: { accepted: [], emitted: [] },
      queuedMessagesCount: 0,
    }
  })

  describe('create', () => {
    it('creates a filter for specific event type', () => {
      const handler = jest.fn()
      const filteredHandler = create('open')(handler)

      const openData: OpenEventData = {
        origin: 'http://example.com',
        contract: { accepted: [], emitted: [] },
      }

      filteredHandler('open', openData, mockChannel)
      expect(handler).toHaveBeenCalledWith('open', openData, mockChannel)
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('does not call handler for different event type', () => {
      const handler = jest.fn()
      const filteredHandler = create('open')(handler)

      const closeData: CloseEventData = { notify: true }

      filteredHandler('close', closeData, mockChannel)
      expect(handler).not.toHaveBeenCalled()
    })

    it('workss with all event types', () => {
      const events: ChannelEvent[] = ['open', 'close', 'cancel', 'deny', 'invalid']

      events.forEach((eventType) => {
        const handler = jest.fn()
        const filteredHandler = create(eventType)(handler)

        // Call with the same event type
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filteredHandler(eventType, <any>{}, mockChannel)
        expect(handler).toHaveBeenCalledTimes(1)

        // Call with different event types
        events
          .filter((e) => e !== eventType)
          .forEach((otherEvent) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            filteredHandler(otherEvent, <any>{}, mockChannel)
          })

        // Should still only be called once
        expect(handler).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('open', () => {
    it('filters for OPEN events only', () => {
      const handler = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredHandler = open(<any>handler)

      const openData: OpenEventData = {
        origin: 'http://example.com',
        contract: { accepted: [], emitted: [] },
      }

      filteredHandler('open', openData, mockChannel)
      expect(handler).toHaveBeenCalledWith('open', openData, mockChannel)
    })

    it('does not call handler for CLOSE events', () => {
      const handler = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredHandler = open(<any>handler)

      const closeData: CloseEventData = { notify: true }

      filteredHandler('close', closeData, mockChannel)
      expect(handler).not.toHaveBeenCalled()
    })

    it('does not call handler for other event types', () => {
      const handler = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredHandler = open(<any>handler)

      filteredHandler('cancel', { notify: true }, mockChannel)
      filteredHandler('deny', { reason: 'test' }, mockChannel)
      filteredHandler('invalid', { error: 'test' }, mockChannel)

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('close', () => {
    it('filterss for CLOSE events only', () => {
      const handler = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredHandler = close(<any>handler)

      const closeData: CloseEventData = { notify: true }

      filteredHandler('close', closeData, mockChannel)
      expect(handler).toHaveBeenCalledWith('close', closeData, mockChannel)
    })

    it('does not call handler for other event types', () => {
      const handler = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredHandler = close(<any>handler)

      const openData: OpenEventData = {
        origin: 'http://example.com',
        contract: { accepted: [], emitted: [] },
      }

      filteredHandler('open', openData, mockChannel)
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('cancel', () => {
    it('filterss for CANCEL events only', () => {
      const handler = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredHandler = cancel(<any>handler)

      const cancelData: CancelEventData = { notify: true }

      filteredHandler('cancel', cancelData, mockChannel)
      expect(handler).toHaveBeenCalledWith('cancel', cancelData, mockChannel)
    })

    it('does not call handler for other event types', () => {
      const handler = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredHandler = cancel(<any>handler)

      filteredHandler('open', { origin: 'http://test.com', contract: { accepted: [], emitted: [] } }, mockChannel)
      filteredHandler('close', { notify: true }, mockChannel)

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('deny', () => {
    it('filterss for DENY events only', () => {
      const handler = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredHandler = deny(<any>handler)

      const denyData: DenyEventData = { reason: 'Test denial' }

      filteredHandler('deny', denyData, mockChannel)
      expect(handler).toHaveBeenCalledWith('deny', denyData, mockChannel)
    })

    it('does not call handler for other event types', () => {
      const handler = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredHandler = deny(<any>handler)

      filteredHandler('cancel', { notify: false }, mockChannel)
      filteredHandler('invalid', { error: 'test' }, mockChannel)

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('invalid', () => {
    it('filterss for INVALID events only', () => {
      const handler = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredHandler = invalid(<any>handler)

      const invalidData: InvalidEventData = { error: 'Test error' }

      filteredHandler('invalid', invalidData, mockChannel)
      expect(handler).toHaveBeenCalledWith('invalid', invalidData, mockChannel)
    })

    it('does not call handler for other event types', () => {
      const handler = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredHandler = invalid(<any>handler)

      filteredHandler('open', { origin: 'http://test.com', contract: { accepted: [], emitted: [] } }, mockChannel)
      filteredHandler('deny', { reason: 'test' }, mockChannel)

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('Integration - Multiple filters', () => {
    it('allows multiple handlers with different filters', () => {
      const openHandler = jest.fn()
      const closeHandler = jest.fn()
      const cancelHandler = jest.fn()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredOpen = open(<any>openHandler)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredClose = close(<any>closeHandler)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredCancel = cancel(<any>cancelHandler)

      const openData: OpenEventData = {
        origin: 'http://example.com',
        contract: { accepted: [], emitted: [] },
      }
      const closeData: CloseEventData = { notify: true }
      const cancelData: CancelEventData = { notify: false }

      // Simulate event sequence
      filteredOpen('open', openData, mockChannel)
      filteredClose('open', openData, mockChannel)
      filteredCancel('open', openData, mockChannel)

      expect(openHandler).toHaveBeenCalledTimes(1)
      expect(closeHandler).not.toHaveBeenCalled()
      expect(cancelHandler).not.toHaveBeenCalled()

      filteredOpen('close', closeData, mockChannel)
      filteredClose('close', closeData, mockChannel)
      filteredCancel('close', closeData, mockChannel)

      expect(openHandler).toHaveBeenCalledTimes(1)
      expect(closeHandler).toHaveBeenCalledTimes(1)
      expect(cancelHandler).not.toHaveBeenCalled()

      filteredOpen('cancel', cancelData, mockChannel)
      filteredClose('cancel', cancelData, mockChannel)
      filteredCancel('cancel', cancelData, mockChannel)

      expect(openHandler).toHaveBeenCalledTimes(1)
      expect(closeHandler).toHaveBeenCalledTimes(1)
      expect(cancelHandler).toHaveBeenCalledTimes(1)
    })
  })
})
