import { describe, expect, it } from 'vitest'
import { T0, sampleRecord } from './__test-utils__/fixtures'
import { fromRecord } from './execution'
import {
  MIN_WINDOW_MS,
  barsAt,
  clampWindow,
  fitWindow,
  packRows,
  panWindow,
  tickStep,
  tickTimes,
  timeToX,
  timelineLanes,
  xToTime,
  zoomOf,
  zoomWindow,
} from './timeline'

const execution = fromRecord(sampleRecord())
const lanes = timelineLanes(execution)
const clock = { start: 0, end: 100_000 }

describe('timelineLanes', () => {
  it('draws one row per chain with its bars in start order', () => {
    expect(lanes[0]?.chains.map((row) => [row.key, row.bars.map((bar) => bar.task.target)])).toEqual([
      ['lib-a', ['typecheck', 'build', 'publish']],
      ['lib-b', ['lint', 'test']],
    ])
  })

  it('packs the bars of a lane into one row per slot in use', () => {
    expect(lanes[0]?.slots.map((row) => row.bars.map((bar) => bar.task.id))).toEqual([
      ['lib-b:lint', 'lib-a:build', 'lib-a:publish'],
      ['lib-a:typecheck'],
      ['lib-b:test'],
    ])
  })

  it('counts the peak as the slot rows', () => {
    expect(lanes.map((lane) => lane.peak)).toEqual([3, 1])
  })

  it('keeps a task without timing aside as unrun', () => {
    const record = sampleRecord()
    const partial = fromRecord({ ...record, results: { linux: record.results.linux } })
    expect(timelineLanes(partial)[1]?.unrun.map((task) => task.id)).toEqual(['lib-a:typecheck', 'lib-a:build'])
  })
})

describe('packRows', () => {
  it('reuses a row once its last bar ended', () => {
    const bar = (start: number, end: number) => ({ start, end }) as Parameters<typeof packRows>[0][number]
    expect(packRows([bar(0, 10), bar(5, 8), bar(10, 12), bar(9, 11)]).map((row) => row.map((member) => member.start))).toEqual([
      [0, 10],
      [5, 9],
    ])
  })
})

describe('windows', () => {
  it('fits the whole clock', () => {
    expect(fitWindow(clock)).toEqual({ start: 0, end: 100_000 })
  })

  it('fits a second when the clock has not started', () => {
    expect(fitWindow({ start: null, end: null })).toEqual({ start: 0, end: 1000 })
  })

  it('zooms in around the anchor', () => {
    expect(zoomWindow(fitWindow(clock), clock, 2, 0.5)).toEqual({ start: 25_000, end: 75_000 })
  })

  it('never narrows below the minimum window', () => {
    const window = zoomWindow(fitWindow(clock), clock, 1_000_000, 0)
    expect(window.end - window.start).toBe(MIN_WINDOW_MS)
  })

  it('never widens beyond the clock', () => {
    expect(zoomWindow({ start: 20_000, end: 30_000 }, clock, 0.001, 0.5)).toEqual({ start: 0, end: 100_000 })
  })

  it('pans and stops at the end', () => {
    expect(panWindow({ start: 60_000, end: 80_000 }, clock, 50_000)).toEqual({ start: 80_000, end: 100_000 })
  })

  it('clamps a window that drifted before the start', () => {
    expect(clampWindow({ start: -5_000, end: 5_000 }, clock)).toEqual({ start: 0, end: 10_000 })
  })

  it('reports the zoom as the clock over the window', () => {
    expect(zoomOf({ start: 0, end: 25_000 }, clock)).toBe(4)
  })

  it('maps a time to a pixel and back', () => {
    const window = { start: 10_000, end: 20_000 }
    expect(xToTime(timeToX(12_500, window, 400), window, 400)).toBe(12_500)
  })
})

describe('ticks', () => {
  it('picks the smallest round step that keeps the marks apart', () => {
    expect(tickStep(600_000, 800, 72)).toBe(60_000)
  })

  it('marks multiples of the step from the clock start inside the window', () => {
    expect(tickTimes({ start: 12_000, end: 31_000 }, clock, 5_000)).toEqual([15_000, 20_000, 25_000, 30_000])
  })
})

describe('barsAt', () => {
  it('lists the bars under way at a time across every lane', () => {
    expect(barsAt(lanes, T0 + 20_000).map((bar) => `${bar.task.id}@${bar.task.environment}`)).toEqual([
      'lib-a:build@linux',
      'lib-b:test@linux',
      'lib-a:build@windows',
    ])
  })

  it('counts a bar that ends at the time as over', () => {
    expect(barsAt(lanes, T0 + 10_000).map((bar) => bar.task.id)).toEqual(['lib-a:build', 'lib-b:test', 'lib-a:typecheck'])
  })
})
