import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AlarmFireHandler } from '../alarm-engine'
import { createAlarmEngine } from '../alarm-engine'

const NOON_UTC = Date.UTC(2026, 6, 1, 12, 0, 0)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOON_UTC)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('set', () => {
  it('arms an alarm at the next occurrence with a stable id', () => {
    const engine = createAlarmEngine(() => {})
    expect(engine.set('13:30', 'UTC', 'tea')).toEqual({
      id: 'alarm-1',
      at: '13:30',
      label: 'tea',
      firesAtEpochMs: Date.UTC(2026, 6, 1, 13, 30),
    })
  })

  it('omits the label field when none is given', () => {
    const engine = createAlarmEngine(() => {})
    expect('label' in engine.set('13:30', 'UTC')).toBe(false)
  })
})

describe('firing', () => {
  it('fires the callback with the alarm when its time arrives', () => {
    const onFire = vi.fn<AlarmFireHandler>()
    const engine = createAlarmEngine(onFire)
    engine.set('12:01', 'UTC')
    vi.advanceTimersByTime(60_000)
    expect(onFire).toHaveBeenCalledWith(expect.objectContaining({ id: 'alarm-1', at: '12:01' }))
  })

  it('does not fire before its time', () => {
    const onFire = vi.fn<AlarmFireHandler>()
    const engine = createAlarmEngine(onFire)
    engine.set('12:02', 'UTC')
    vi.advanceTimersByTime(60_000)
    expect(onFire).not.toHaveBeenCalled()
  })

  it('is one-shot: the fired alarm leaves the armed list', () => {
    const engine = createAlarmEngine(() => {})
    engine.set('12:01', 'UTC')
    vi.advanceTimersByTime(60_000)
    expect(engine.list()).toEqual([])
  })

  it('supports multiple armed alarms firing independently', () => {
    const onFire = vi.fn<AlarmFireHandler>()
    const engine = createAlarmEngine(onFire)
    engine.set('12:01', 'UTC')
    engine.set('12:03', 'UTC')
    vi.advanceTimersByTime(3 * 60_000)
    expect(onFire.mock.calls.map(([alarm]) => alarm.at)).toEqual(['12:01', '12:03'])
  })
})

describe('clear', () => {
  it('disarms an alarm so it never fires', () => {
    const onFire = vi.fn<AlarmFireHandler>()
    const engine = createAlarmEngine(onFire)
    const alarm = engine.set('12:01', 'UTC')
    engine.clear(alarm.id)
    vi.advanceTimersByTime(120_000)
    expect(onFire).not.toHaveBeenCalled()
  })

  it('returns null for an unknown id', () => {
    const engine = createAlarmEngine(() => {})
    expect(engine.clear('alarm-99')).toBeNull()
  })
})

describe('list', () => {
  it('orders armed alarms soonest first', () => {
    const engine = createAlarmEngine(() => {})
    engine.set('18:00', 'UTC')
    engine.set('13:00', 'UTC')
    expect(engine.list().map((alarm) => alarm.at)).toEqual(['13:00', '18:00'])
  })
})

describe('dispose', () => {
  it('cancels every pending timer', () => {
    const onFire = vi.fn<AlarmFireHandler>()
    const engine = createAlarmEngine(onFire)
    engine.set('12:01', 'UTC')
    engine.dispose()
    vi.advanceTimersByTime(120_000)
    expect(onFire).not.toHaveBeenCalled()
  })
})
