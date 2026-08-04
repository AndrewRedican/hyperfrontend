import type { BeatEvent, RhythmEvent } from '../../rhythm/rhythm-engine'
import type { FeatureLink, RhythmLink } from '../wire-contract'
import { describe, expect, it } from 'vitest'
import { wireHeartbeatContract } from '../wire-contract'

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

/** A fake rhythm engine exposing listener triggers and recording applied rates. */
function createFakeRhythm() {
  const beatListeners: Array<(beat: BeatEvent) => void> = []
  const rhythmListeners: Array<(change: RhythmEvent) => void> = []
  const applied: number[] = []
  const link: RhythmLink = {
    setRate: (bpm) => {
      applied.push(bpm)
      return Math.min(180, Math.max(40, bpm))
    },
    onBeat: (listener) => {
      beatListeners.push(listener)
      return () => {}
    },
    onRhythm: (listener) => {
      rhythmListeners.push(listener)
      return () => {}
    },
  }
  return {
    link,
    applied,
    emitBeat: (beat: BeatEvent) => beatListeners.forEach((listener) => listener(beat)),
    emitRhythm: (change: RhythmEvent) => rhythmListeners.forEach((listener) => listener(change)),
  }
}

function wire() {
  const feature = createFakeFeature()
  const rhythm = createFakeRhythm()
  wireHeartbeatContract(feature.link, rhythm.link)
  return { ...feature, rhythm }
}

describe('beat forwarding', () => {
  it('forwards every beat to the host', () => {
    const { rhythm, sent } = wire()
    const beat: BeatEvent = { at: 1000, seq: 1, bpm: 72, source: 'rhythm' }
    rhythm.emitBeat(beat)
    expect(sent).toEqual([{ type: 'beat', data: beat }])
  })

  it('forwards user beats unchanged', () => {
    const { rhythm, sent } = wire()
    rhythm.emitBeat({ at: 2000, seq: 5, bpm: 72, source: 'user' })
    expect(sent).toEqual([{ type: 'beat', data: expect.objectContaining({ source: 'user' }) }])
  })
})

describe('rhythm forwarding', () => {
  it('forwards rhythm changes to the host', () => {
    const { rhythm, sent } = wire()
    rhythm.emitRhythm({ state: 'flatline', bpm: 0 })
    expect(sent).toEqual([{ type: 'rhythm', data: { state: 'flatline', bpm: 0 } }])
  })

  it('reports dirty while the rhythm is disturbed', () => {
    const { rhythm, dirtyReports } = wire()
    rhythm.emitRhythm({ state: 'suppressed', bpm: 0 })
    expect(dirtyReports).toEqual([true])
  })

  it('reports clean once the rhythm beats again', () => {
    const { rhythm, dirtyReports } = wire()
    rhythm.emitRhythm({ state: 'recovering', bpm: 36 })
    rhythm.emitRhythm({ state: 'beating', bpm: 72 })
    expect(dirtyReports).toEqual([true, false])
  })
})

describe('ping', () => {
  it('answers the request with the echoed timing payload', () => {
    const { respond } = wire()
    expect(respond('ping', { seq: 3, sentAt: 12345 })).toEqual({ seq: 3, sentAt: 12345 })
  })

  it('echoes the same payload as a pong event', () => {
    const { respond, sent } = wire()
    respond('ping', { seq: 3, sentAt: 12345 })
    expect(sent).toEqual([{ type: 'pong', data: { seq: 3, sentAt: 12345 } }])
  })

  it('rejects a malformed ping', () => {
    const { respond } = wire()
    expect(() => respond('ping', { seq: 'three' })).toThrow('ping requires numeric seq and sentAt')
  })
})

describe('set-rate', () => {
  it('applies a numeric rate to the rhythm', () => {
    const { dispatch, rhythm } = wire()
    dispatch('set-rate', { bpm: 120 })
    expect(rhythm.applied).toEqual([120])
  })

  it('ignores a non-numeric rate', () => {
    const { dispatch, rhythm } = wire()
    dispatch('set-rate', { bpm: 'fast' })
    expect(rhythm.applied).toEqual([])
  })

  it('ignores a non-finite rate', () => {
    const { dispatch, rhythm } = wire()
    dispatch('set-rate', { bpm: Number.NaN })
    expect(rhythm.applied).toEqual([])
  })

  it('ignores a payload that is not a record', () => {
    const { dispatch, rhythm } = wire()
    dispatch('set-rate', 120)
    expect(rhythm.applied).toEqual([])
  })
})
