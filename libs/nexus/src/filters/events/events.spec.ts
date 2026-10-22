import type { ChannelJSON } from '../../types/channel'
import type { ChannelEvent, OpenEventData, CloseEventData, CancelEventData, DenyEventData, InvalidEventData } from '../../types/events'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { cancel } from './cancel'
import { close } from './close'
import { create } from './create'
import { deny } from './deny'
import { invalid } from './invalid'
import { open } from './open'

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
      peerContract: null,
      peerId: null,
      queuedMessagesCount: 0,
    }
  })

  describe('create', () => {
    const allEvents: ChannelEvent[] = ['open', 'close', 'cancel', 'deny', 'invalid']

    it('creates a filter for specific event type', () => {
      const handler = jest.fn()
      const filteredHandler = create('open')(handler)

      const openData: OpenEventData = {
        origin: 'http://example.com',
        contract: { accepted: [], emitted: [] },
      }

      filteredHandler('open', openData, mockChannel)
      expect(handler.mock.calls).toEqual([['open', openData, mockChannel]])
    })

    it('does not call handler for different event type', () => {
      const handler = jest.fn()
      const filteredHandler = create('open')(handler)

      const closeData: CloseEventData = { notify: true }

      filteredHandler('close', closeData, mockChannel)
      expect(handler).not.toHaveBeenCalled()
    })

    it.each(allEvents)('forwards only %s events to a handler filtered for that type', (eventType: ChannelEvent) => {
      const handler = jest.fn()
      const filteredHandler = create(eventType)(handler)

      // lint-disable-next-line typescript/no-explicit-any
      filteredHandler(eventType, {} as any, mockChannel)
      const callsAfterOwnEvent = handler.mock.calls.length

      allEvents
        .filter((e) => e !== eventType)
        .forEach((otherEvent) => {
          // lint-disable-next-line typescript/no-explicit-any
          filteredHandler(otherEvent, {} as any, mockChannel)
        })

      expect({ callsAfterOwnEvent, callsAfterOtherEvents: handler.mock.calls.length }).toEqual({
        callsAfterOwnEvent: 1,
        callsAfterOtherEvents: 1,
      })
    })
  })

  describe('open', () => {
    it('filters for OPEN events only', () => {
      const handler = jest.fn()
      // lint-disable-next-line typescript/no-explicit-any
      const filteredHandler = open(handler as any)

      const openData: OpenEventData = {
        origin: 'http://example.com',
        contract: { accepted: [], emitted: [] },
      }

      filteredHandler('open', openData, mockChannel)
      expect(handler).toHaveBeenCalledWith('open', openData, mockChannel)
    })

    it('does not call handler for CLOSE events', () => {
      const handler = jest.fn()
      // lint-disable-next-line typescript/no-explicit-any
      const filteredHandler = open(handler as any)

      const closeData: CloseEventData = { notify: true }

      filteredHandler('close', closeData, mockChannel)
      expect(handler).not.toHaveBeenCalled()
    })

    it('does not call handler for other event types', () => {
      const handler = jest.fn()
      // lint-disable-next-line typescript/no-explicit-any
      const filteredHandler = open(handler as any)

      filteredHandler('cancel', { notify: true }, mockChannel)
      filteredHandler('deny', { reason: 'test' }, mockChannel)
      filteredHandler('invalid', { error: 'test' }, mockChannel)

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('close', () => {
    it('filterss for CLOSE events only', () => {
      const handler = jest.fn()
      // lint-disable-next-line typescript/no-explicit-any
      const filteredHandler = close(handler as any)

      const closeData: CloseEventData = { notify: true }

      filteredHandler('close', closeData, mockChannel)
      expect(handler).toHaveBeenCalledWith('close', closeData, mockChannel)
    })

    it('does not call handler for other event types', () => {
      const handler = jest.fn()
      // lint-disable-next-line typescript/no-explicit-any
      const filteredHandler = close(handler as any)

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
      // lint-disable-next-line typescript/no-explicit-any
      const filteredHandler = cancel(handler as any)

      const cancelData: CancelEventData = { notify: true }

      filteredHandler('cancel', cancelData, mockChannel)
      expect(handler).toHaveBeenCalledWith('cancel', cancelData, mockChannel)
    })

    it('does not call handler for other event types', () => {
      const handler = jest.fn()
      // lint-disable-next-line typescript/no-explicit-any
      const filteredHandler = cancel(handler as any)

      filteredHandler('open', { origin: 'http://test.com', contract: { accepted: [], emitted: [] } }, mockChannel)
      filteredHandler('close', { notify: true }, mockChannel)

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('deny', () => {
    it('filterss for DENY events only', () => {
      const handler = jest.fn()
      // lint-disable-next-line typescript/no-explicit-any
      const filteredHandler = deny(handler as any)

      const denyData: DenyEventData = { reason: 'Test denial' }

      filteredHandler('deny', denyData, mockChannel)
      expect(handler).toHaveBeenCalledWith('deny', denyData, mockChannel)
    })

    it('does not call handler for other event types', () => {
      const handler = jest.fn()
      // lint-disable-next-line typescript/no-explicit-any
      const filteredHandler = deny(handler as any)

      filteredHandler('cancel', { notify: false }, mockChannel)
      filteredHandler('invalid', { error: 'test' }, mockChannel)

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('invalid', () => {
    it('filterss for INVALID events only', () => {
      const handler = jest.fn()
      // lint-disable-next-line typescript/no-explicit-any
      const filteredHandler = invalid(handler as any)

      const invalidData: InvalidEventData = { error: 'Test error' }

      filteredHandler('invalid', invalidData, mockChannel)
      expect(handler).toHaveBeenCalledWith('invalid', invalidData, mockChannel)
    })

    it('does not call handler for other event types', () => {
      const handler = jest.fn()
      // lint-disable-next-line typescript/no-explicit-any
      const filteredHandler = invalid(handler as any)

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

      // lint-disable-next-line typescript/no-explicit-any
      const filteredOpen = open(openHandler as any)
      // lint-disable-next-line typescript/no-explicit-any
      const filteredClose = close(closeHandler as any)
      // lint-disable-next-line typescript/no-explicit-any
      const filteredCancel = cancel(cancelHandler as any)

      const openData: OpenEventData = {
        origin: 'http://example.com',
        contract: { accepted: [], emitted: [] },
      }
      const closeData: CloseEventData = { notify: true }
      const cancelData: CancelEventData = { notify: false }
      const snapshot = (after: ChannelEvent) => ({
        after,
        open: openHandler.mock.calls.length,
        close: closeHandler.mock.calls.length,
        cancel: cancelHandler.mock.calls.length,
      })

      filteredOpen('open', openData, mockChannel)
      filteredClose('open', openData, mockChannel)
      filteredCancel('open', openData, mockChannel)
      const afterOpen = snapshot('open')

      filteredOpen('close', closeData, mockChannel)
      filteredClose('close', closeData, mockChannel)
      filteredCancel('close', closeData, mockChannel)
      const afterClose = snapshot('close')

      filteredOpen('cancel', cancelData, mockChannel)
      filteredClose('cancel', cancelData, mockChannel)
      filteredCancel('cancel', cancelData, mockChannel)
      const afterCancel = snapshot('cancel')

      expect([afterOpen, afterClose, afterCancel]).toEqual([
        { after: 'open', open: 1, close: 0, cancel: 0 },
        { after: 'close', open: 1, close: 1, cancel: 0 },
        { after: 'cancel', open: 1, close: 1, cancel: 1 },
      ])
    })
  })
})
