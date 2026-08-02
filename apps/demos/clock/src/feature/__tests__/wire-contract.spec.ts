import type { FeatureLink } from '../wire-contract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createClockStore } from '../../state/clock-store'
import { wireClockContract } from '../wire-contract'

const NOON_UTC = Date.UTC(2026, 6, 1, 12, 0, 0)

/** A fake feature handle capturing sends, dirty reports, and exposing handler dispatch. */
function createFakeFeature() {
  const handlers = new Map<string, (data: unknown) => void>()
  const responders = new Map<string, (data: unknown) => unknown>()
  const sent: { type: string; data: unknown }[] = []
  const dirtyReports: boolean[] = []
  const link: FeatureLink = {
    send: (type, data) => {
      sent.push({ type, data })
    },
    on: (event, handler) => {
      handlers.set(event, handler)
      return () => {}
    },
    handle: (type, handler) => {
      responders.set(type, handler)
      return () => {}
    },
    setDirty: (dirty) => {
      dirtyReports.push(dirty)
    },
  }
  return {
    link,
    sent,
    dirtyReports,
    dispatch: (type: string, data?: unknown) => handlers.get(type)?.(data),
    respond: (type: string, data?: unknown) => responders.get(type)?.(data),
  }
}

function wire() {
  const feature = createFakeFeature()
  const store = createClockStore()
  store.timezone.value = 'UTC'
  store.locale.value = 'en-US'
  const startTicking = wireClockContract(feature.link, store, { now: () => Date.now() })
  return { ...feature, store, startTicking }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOON_UTC)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('get-time', () => {
  it('answers the request with the time snapshot', () => {
    const { respond } = wire()
    expect(respond('get-time')).toEqual({
      epochMs: NOON_UTC,
      iso: '2026-07-01T12:00:00.000Z',
      timezone: 'UTC',
      locale: 'en-US',
      format: 'analog',
      formatted: expect.stringContaining('12:00'),
    })
  })

  it('echoes the same snapshot as a time event', () => {
    const { respond, sent } = wire()
    respond('get-time')
    expect(sent).toEqual([{ type: 'time', data: expect.objectContaining({ epochMs: NOON_UTC }) }])
  })
})

describe('set-format', () => {
  it('moves the store format so the coin flips', () => {
    const { dispatch, store } = wire()
    dispatch('set-format', { format: 'digital' })
    expect(store.format.value).toBe('digital')
  })

  it('defers the echo until the coin settles', () => {
    const { dispatch, sent } = wire()
    dispatch('set-format', { format: 'digital' })
    expect(sent).toEqual([])
  })

  it('ignores an unknown format', () => {
    const { dispatch, store } = wire()
    dispatch('set-format', { format: 'sundial' })
    expect(store.format.value).toBe('analog')
  })
})

describe('format-changed', () => {
  it('emits with the settle cause when the face changes', () => {
    const { store, sent } = wire()
    store.notifyFormatSettled('digital', 'host')
    expect(sent).toEqual([{ type: 'format-changed', data: { format: 'digital', cause: 'host' } }])
  })

  it('stays silent when the coin lands back on the same face', () => {
    const { store, sent } = wire()
    store.notifyFormatSettled('analog', 'user')
    expect(sent).toEqual([])
  })
})

describe('set-timezone', () => {
  it('applies a valid IANA id and echoes timezone-changed', () => {
    const { dispatch, store, sent } = wire()
    dispatch('set-timezone', { timezone: 'Asia/Tokyo' })
    expect({ timezone: store.timezone.value, sent }).toEqual({
      timezone: 'Asia/Tokyo',
      sent: [{ type: 'timezone-changed', data: { timezone: 'Asia/Tokyo' } }],
    })
  })

  it('ignores an invalid timezone', () => {
    const { dispatch, store, sent } = wire()
    dispatch('set-timezone', { timezone: 'Mars/Olympus_Mons' })
    expect({ timezone: store.timezone.value, sent }).toEqual({ timezone: 'UTC', sent: [] })
  })
})

describe('set-locale', () => {
  it('applies a valid BCP-47 tag and echoes locale-changed', () => {
    const { dispatch, store, sent } = wire()
    dispatch('set-locale', { locale: 'es-CR' })
    expect({ locale: store.locale.value, sent }).toEqual({
      locale: 'es-CR',
      sent: [{ type: 'locale-changed', data: { locale: 'es-CR' } }],
    })
  })

  it('ignores a malformed locale', () => {
    const { dispatch, store, sent } = wire()
    dispatch('set-locale', { locale: '!!' })
    expect({ locale: store.locale.value, sent }).toEqual({ locale: 'en-US', sent: [] })
  })
})

describe('set-alarm', () => {
  it('arms an alarm and echoes alarm-set with the resolved fire time', () => {
    const { dispatch, sent } = wire()
    dispatch('set-alarm', { at: '13:30', label: 'tea' })
    expect(sent).toEqual([{ type: 'alarm-set', data: { id: 'alarm-1', at: '13:30', firesAtEpochMs: Date.UTC(2026, 6, 1, 13, 30) } }])
  })

  it('ignores a malformed time', () => {
    const { dispatch, sent, store } = wire()
    dispatch('set-alarm', { at: '25:99' })
    expect({ sent, alarms: store.alarms.value }).toEqual({ sent: [], alarms: [] })
  })
})

describe('clear-alarm', () => {
  it('disarms and echoes alarm-cleared', () => {
    const { dispatch, sent } = wire()
    dispatch('set-alarm', { at: '13:30' })
    dispatch('clear-alarm', { id: 'alarm-1' })
    expect(sent[sent.length - 1]).toEqual({ type: 'alarm-cleared', data: { id: 'alarm-1' } })
  })

  it('stays silent for an unknown id', () => {
    const { dispatch, sent } = wire()
    dispatch('clear-alarm', { id: 'alarm-42' })
    expect(sent).toEqual([])
  })
})

describe('alarm-fired', () => {
  it('emits when an armed alarm reaches its time', () => {
    const { dispatch, sent } = wire()
    dispatch('set-alarm', { at: '12:01', label: 'tea' })
    vi.advanceTimersByTime(60_000)
    expect(sent[sent.length - 1]).toEqual({ type: 'alarm-fired', data: { id: 'alarm-1', at: '12:01', label: 'tea' } })
  })

  it('omits the label when the alarm has none', () => {
    const { dispatch, sent } = wire()
    dispatch('set-alarm', { at: '12:01' })
    vi.advanceTimersByTime(60_000)
    expect(sent[sent.length - 1]).toEqual({ type: 'alarm-fired', data: { id: 'alarm-1', at: '12:01' } })
  })
})

describe('dirty state', () => {
  it('reports dirty when an alarm is armed', () => {
    const { dispatch, dirtyReports } = wire()
    dispatch('set-alarm', { at: '13:30' })
    expect(dirtyReports).toEqual([true])
  })

  it('reports clean once the last alarm is cleared', () => {
    const { dispatch, dirtyReports } = wire()
    dispatch('set-alarm', { at: '13:30' })
    dispatch('clear-alarm', { id: 'alarm-1' })
    expect(dirtyReports).toEqual([true, false])
  })

  it('reports clean after the last alarm fires', () => {
    const { dispatch, dirtyReports } = wire()
    dispatch('set-alarm', { at: '12:01' })
    vi.advanceTimersByTime(60_000)
    expect(dirtyReports).toEqual([true, false])
  })

  it('stays silent while no alarm state changes', () => {
    const { dispatch, dirtyReports } = wire()
    dispatch('set-format', { format: 'digital' })
    expect(dirtyReports).toEqual([])
  })
})

describe('tick', () => {
  it('streams one snapshot per second once started', () => {
    const { startTicking, sent } = wire()
    const stop = startTicking()
    vi.advanceTimersByTime(3000)
    stop()
    vi.advanceTimersByTime(3000)
    expect(sent.map((message) => message.type)).toEqual(['tick', 'tick', 'tick'])
  })
})
