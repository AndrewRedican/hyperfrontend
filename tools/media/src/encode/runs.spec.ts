import type { RawFrame } from './runs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { decimate, foldDuplicates } from './runs'

/**
 * A one-pixel frame of a stated colour.
 *
 * @param value - The byte every channel holds.
 * @returns A frame that equals another of the same value byte for byte.
 */
function frame(value: number): RawFrame {
  return { data: Buffer.from([value, value, value]), width: 1, height: 1 }
}

describe('foldDuplicates', () => {
  it('leaves a run of distinct frames alone', () => {
    expect(foldDuplicates([frame(1), frame(2), frame(3)], [100, 100, 100])).toEqual({
      frames: [frame(1), frame(2), frame(3)],
      delaysMs: [100, 100, 100],
    })
  })

  it('folds a repeated frame into the one before it, adding up the delays', () => {
    expect(foldDuplicates([frame(1), frame(2), frame(2), frame(2)], [100, 100, 150, 200])).toEqual({
      frames: [frame(1), frame(2)],
      delaysMs: [100, 450],
    })
  })

  it('keeps a frame that comes back after a different one', () => {
    expect(foldDuplicates([frame(1), frame(2), frame(1)], [100, 100, 100]).frames).toEqual([frame(1), frame(2), frame(1)])
  })

  it('folds nothing out of nothing', () => {
    expect(foldDuplicates([], [])).toEqual({ frames: [], delaysMs: [] })
  })

  it('shows a frame with no delay recorded for no time', () => {
    expect(foldDuplicates([frame(1), frame(2)], [100])).toEqual({ frames: [frame(1), frame(2)], delaysMs: [100, 0] })
  })
})

describe('decimate', () => {
  it('keeps every frame when asked to keep every one', () => {
    expect(decimate([frame(1), frame(2)], [100, 100], 1)).toEqual({ frames: [frame(1), frame(2)], delaysMs: [100, 100] })
  })

  it('keeps every second frame and hands it the time of the one it stands for', () => {
    expect(decimate([frame(1), frame(2), frame(3), frame(4)], [100, 100, 100, 100], 2)).toEqual({
      frames: [frame(1), frame(3)],
      delaysMs: [200, 200],
    })
  })

  it('gives a trailing survivor the time of the frames after it', () => {
    expect(decimate([frame(1), frame(2), frame(3)], [100, 100, 100], 2)).toEqual({ frames: [frame(1), frame(3)], delaysMs: [200, 100] })
  })

  it('plays the same total time whatever it keeps', () => {
    const delays = [100, 120, 90, 110, 100]
    const thinned = decimate([frame(1), frame(2), frame(3), frame(4), frame(5)], delays, 3)
    expect(thinned.delaysMs.reduce((sum, delay) => sum + delay, 0)).toBe(520)
  })
})
