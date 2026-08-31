import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createPromise, promiseAllSettled, promiseReject, promiseResolve } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'
import { ControlType } from './control'
import { createRequestPeer } from './request'

interface ScheduledTimer {
  id: number
  delay: number | undefined
  callback: () => void
}

jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/timers', () => {
  let nextId = 0
  const scheduled: ScheduledTimer[] = []
  return {
    setTimeout: (callback: () => void, delay?: number) => {
      const id = (nextId += 1)
      scheduled.push({ id, delay, callback })
      return id
    },
    clearTimeout: (id: number) => {
      const index = scheduled.findIndex((timer) => timer.id === id)
      if (index >= 0) {
        scheduled.splice(index, 1)
      }
    },
    __getScheduled: () => scheduled,
  }
})

const timers = jest.requireMock('@hyperfrontend/immutable-api-utils/built-in-copy/timers') as { __getScheduled(): ScheduledTimer[] }

function scheduledTimers(): ScheduledTimer[] {
  return timers.__getScheduled()
}

function fireNextTimer(): void {
  const timer = scheduledTimers().shift()
  if (!timer) {
    throw createError('expected a scheduled timer')
  }
  timer.callback()
}

function flush() {
  return createPromise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

function envelopeAt(send: jest.Mock, index: number): Record<string, unknown> {
  const call = send.mock.calls[index]
  if (!call) {
    throw createError(`expected a sent envelope at index ${index}`)
  }
  return call[1] as Record<string, unknown>
}

beforeEach(() => {
  scheduledTimers().length = 0
})

describe('createRequestPeer', () => {
  describe('outbound requests', () => {
    it('sends a correlated request envelope', () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      peer.request('getTime', { tz: 'UTC' }).catch(() => undefined)
      expect(send).toHaveBeenCalledWith(
        ControlType.Request,
        expect.objectContaining({ correlationId: expect.any(String), from: 'host', innerType: 'getTime', payload: { tz: 'UTC' } })
      )
    })

    it('generates a distinct correlation id per request', () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      peer.request('a').catch(() => undefined)
      peer.request('b').catch(() => undefined)
      expect(envelopeAt(send, 0)['correlationId']).not.toBe(envelopeAt(send, 1)['correlationId'])
    })

    it('resolves the request with the ok response payload', async () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      const pending = peer.request('getTime')
      peer.dispatch(ControlType.Response, {
        correlationId: envelopeAt(send, 0)['correlationId'],
        from: 'feature',
        ok: true,
        payload: '12:00',
      })
      await expect(pending).resolves.toBe('12:00')
    })

    it('rejects the request with the error response message', async () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      const pending = peer.request('getTime')
      peer.dispatch(ControlType.Response, {
        correlationId: envelopeAt(send, 0)['correlationId'],
        from: 'feature',
        ok: false,
        error: 'boom',
      })
      await expect(pending).rejects.toThrow('boom')
    })

    it('rejects with a generic message when the error response carries none', async () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      const pending = peer.request('getTime')
      peer.dispatch(ControlType.Response, {
        correlationId: envelopeAt(send, 0)['correlationId'],
        from: 'feature',
        innerType: 'getTime',
        ok: false,
      })
      await expect(pending).rejects.toThrow("Request 'getTime' failed.")
    })

    it('ignores a response with an unknown correlation id', () => {
      const peer = createRequestPeer('host', jest.fn())
      expect(() => peer.dispatch(ControlType.Response, { correlationId: 'nope', from: 'feature', ok: true })).not.toThrow()
    })

    it('schedules the default 30 second timeout', () => {
      const peer = createRequestPeer('host', jest.fn())
      peer.request('getTime').catch(() => undefined)
      expect(scheduledTimers()).toEqual([expect.objectContaining({ delay: 30000 })])
    })

    it('rejects the request when its timeout elapses', async () => {
      const peer = createRequestPeer('host', jest.fn())
      const pending = peer.request('getTime', undefined, { timeoutMs: 5 })
      fireNextTimer()
      await expect(pending).rejects.toThrow("Request 'getTime' timed out after 5ms.")
    })

    it('ignores a response that arrives after the timeout', async () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      const pending = peer.request('getTime', undefined, { timeoutMs: 5 })
      fireNextTimer()
      peer.dispatch(ControlType.Response, {
        correlationId: envelopeAt(send, 0)['correlationId'],
        from: 'feature',
        ok: true,
        payload: 'late',
      })
      await expect(pending).rejects.toThrow('timed out')
    })

    it('releases the timeout timer when the response arrives', async () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      const pending = peer.request('getTime')
      peer.dispatch(ControlType.Response, { correlationId: envelopeAt(send, 0)['correlationId'], from: 'feature', ok: true })
      await pending
      expect(scheduledTimers()).toHaveLength(0)
    })
  })

  describe('inbound requests', () => {
    const incoming = (innerType: string, payload?: unknown) => ({ correlationId: 'feature-1', from: 'feature', innerType, payload })

    it('answers a request with the handler return value', async () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      peer.handle('getTime', () => '12:00')
      peer.dispatch(ControlType.Request, incoming('getTime'))
      await flush()
      expect(send).toHaveBeenCalledWith(
        ControlType.Response,
        expect.objectContaining({ correlationId: 'feature-1', from: 'host', innerType: 'getTime', ok: true, payload: '12:00' })
      )
    })

    it('passes the request payload to the handler', async () => {
      const peer = createRequestPeer('host', jest.fn())
      const handler = jest.fn()
      peer.handle('getTime', handler)
      peer.dispatch(ControlType.Request, incoming('getTime', { tz: 'UTC' }))
      await flush()
      expect(handler).toHaveBeenCalledWith({ tz: 'UTC' })
    })

    it('awaits a promise-returning handler', async () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      peer.handle('getTime', () => promiseResolve('later'))
      peer.dispatch(ControlType.Request, incoming('getTime'))
      await flush()
      expect(send).toHaveBeenCalledWith(ControlType.Response, expect.objectContaining({ ok: true, payload: 'later' }))
    })

    it('reports a throwing handler as an error response', async () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      peer.handle('getTime', () => {
        throw createError('clock offline')
      })
      peer.dispatch(ControlType.Request, incoming('getTime'))
      await flush()
      expect(send).toHaveBeenCalledWith(ControlType.Response, expect.objectContaining({ ok: false, error: 'clock offline' }))
    })

    it('reports a rejecting handler as an error response', async () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      peer.handle('getTime', () => promiseReject(createError('clock offline')))
      peer.dispatch(ControlType.Request, incoming('getTime'))
      await flush()
      expect(send).toHaveBeenCalledWith(ControlType.Response, expect.objectContaining({ ok: false, error: 'clock offline' }))
    })

    it('stringifies a non-Error handler failure into the error response', async () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      peer.handle('getTime', () => promiseReject('plain failure'))
      peer.dispatch(ControlType.Request, incoming('getTime'))
      await flush()
      expect(send).toHaveBeenCalledWith(ControlType.Response, expect.objectContaining({ ok: false, error: 'plain failure' }))
    })

    it('responds with an error when no handler is registered', async () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      peer.dispatch(ControlType.Request, incoming('missing'))
      await flush()
      expect(send).toHaveBeenCalledWith(
        ControlType.Response,
        expect.objectContaining({ ok: false, error: "No handler is registered for 'missing'." })
      )
    })

    it('throws when registering a second handler for the same type', () => {
      const peer = createRequestPeer('host', jest.fn())
      peer.handle('getTime', () => undefined)
      expect(() => peer.handle('getTime', () => undefined)).toThrow("A handler for 'getTime' is already registered.")
    })

    it('allows re-registering after unregistering', () => {
      const peer = createRequestPeer('host', jest.fn())
      const unregister = peer.handle('getTime', () => undefined)
      unregister()
      expect(() => peer.handle('getTime', () => undefined)).not.toThrow()
    })

    it('keeps the replacement handler when a stale unregister runs', async () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      const staleUnregister = peer.handle('getTime', () => 'old')
      staleUnregister()
      peer.handle('getTime', () => 'new')
      staleUnregister()
      peer.dispatch(ControlType.Request, incoming('getTime'))
      await flush()
      expect(send).toHaveBeenCalledWith(ControlType.Response, expect.objectContaining({ ok: true, payload: 'new' }))
    })
  })

  describe('dispatch filtering', () => {
    it('ignores the echo of its own request envelope', async () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      peer.dispatch(ControlType.Request, { correlationId: 'host-1', from: 'host', innerType: 'getTime' })
      await flush()
      expect(send).not.toHaveBeenCalled()
    })

    it('ignores the echo of its own response envelope', async () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      const pending = peer.request('getTime')
      const correlationId = envelopeAt(send, 0)['correlationId']
      peer.dispatch(ControlType.Response, { correlationId, from: 'host', ok: true, payload: 'echoed' })
      peer.dispatch(ControlType.Response, { correlationId, from: 'feature', ok: true, payload: 'real' })
      await expect(pending).resolves.toBe('real')
    })

    it('ignores non-object control data', async () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      peer.dispatch(ControlType.Request, 'junk')
      await flush()
      expect(send).not.toHaveBeenCalled()
    })

    it('ignores a null control payload', async () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      peer.dispatch(ControlType.Request, null)
      await flush()
      expect(send).not.toHaveBeenCalled()
    })

    it('ignores control types outside the request protocol', async () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      peer.dispatch(ControlType.Beat, { from: 'feature' })
      await flush()
      expect(send).not.toHaveBeenCalled()
    })
  })

  describe('rejectAll', () => {
    it('rejects every pending request with the reason', async () => {
      const peer = createRequestPeer('host', jest.fn())
      const first = peer.request('a')
      const second = peer.request('b')
      peer.rejectAll('channel closed')
      await expect(promiseAllSettled([first, second])).resolves.toEqual([
        expect.objectContaining({ status: 'rejected', reason: expect.objectContaining({ message: 'channel closed' }) }),
        expect.objectContaining({ status: 'rejected', reason: expect.objectContaining({ message: 'channel closed' }) }),
      ])
    })

    it('releases the pending timers', async () => {
      const peer = createRequestPeer('host', jest.fn())
      const pending = peer.request('a')
      peer.rejectAll('channel closed')
      await expect(pending).rejects.toThrow()
      expect(scheduledTimers()).toHaveLength(0)
    })

    it('keeps serving requests made after the flush', async () => {
      const send = jest.fn()
      const peer = createRequestPeer('host', send)
      peer.rejectAll('channel closed')
      const pending = peer.request('getTime')
      peer.dispatch(ControlType.Response, { correlationId: envelopeAt(send, 0)['correlationId'], from: 'feature', ok: true, payload: 'ok' })
      await expect(pending).resolves.toBe('ok')
    })
  })
})
