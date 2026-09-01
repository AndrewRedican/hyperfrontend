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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        filteredHandler(eventType, {} as any, mockChannel)
        expect(handler).toHaveBeenCalledTimes(1)

        events
          .filter((e) => e !== eventType)
          .forEach((otherEvent) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            filteredHandler(otherEvent, {} as any, mockChannel)
          })

        expect(handler).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('open', () => {
    it('filters for OPEN events only', () => {
      const handler = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredHandler = open(handler as any)

      const closeData: CloseEventData = { notify: true }

      filteredHandler('close', closeData, mockChannel)
      expect(handler).not.toHaveBeenCalled()
    })

    it('does not call handler for other event types', () => {
      const handler = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredHandler = close(handler as any)

      const closeData: CloseEventData = { notify: true }

      filteredHandler('close', closeData, mockChannel)
      expect(handler).toHaveBeenCalledWith('close', closeData, mockChannel)
    })

    it('does not call handler for other event types', () => {
      const handler = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredHandler = cancel(handler as any)

      const cancelData: CancelEventData = { notify: true }

      filteredHandler('cancel', cancelData, mockChannel)
      expect(handler).toHaveBeenCalledWith('cancel', cancelData, mockChannel)
    })

    it('does not call handler for other event types', () => {
      const handler = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredHandler = cancel(handler as any)

      filteredHandler('open', { origin: 'http://test.com', contract: { accepted: [], emitted: [] } }, mockChannel)
      filteredHandler('close', { notify: true }, mockChannel)

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('deny', () => {
    it('filterss for DENY events only', () => {
      const handler = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredHandler = deny(handler as any)

      const denyData: DenyEventData = { reason: 'Test denial' }

      filteredHandler('deny', denyData, mockChannel)
      expect(handler).toHaveBeenCalledWith('deny', denyData, mockChannel)
    })

    it('does not call handler for other event types', () => {
      const handler = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredHandler = deny(handler as any)

      filteredHandler('cancel', { notify: false }, mockChannel)
      filteredHandler('invalid', { error: 'test' }, mockChannel)

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('invalid', () => {
    it('filterss for INVALID events only', () => {
      const handler = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredHandler = invalid(handler as any)

      const invalidData: InvalidEventData = { error: 'Test error' }

      filteredHandler('invalid', invalidData, mockChannel)
      expect(handler).toHaveBeenCalledWith('invalid', invalidData, mockChannel)
    })

    it('does not call handler for other event types', () => {
      const handler = jest.fn()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredOpen = open(openHandler as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredClose = close(closeHandler as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filteredCancel = cancel(cancelHandler as any)

      const openData: OpenEventData = {
        origin: 'http://example.com',
        contract: { accepted: [], emitted: [] },
      }
      const closeData: CloseEventData = { notify: true }
      const cancelData: CancelEventData = { notify: false }

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
