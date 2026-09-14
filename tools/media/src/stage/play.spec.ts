import { describe, expect, it } from '@hyperfrontend/testing'
import { planTimeline } from './play'

describe('planTimeline', () => {
  it('lands one frame per period on an even grid', () => {
    expect(planTimeline(1_000, 4, 0)).toEqual({ atMs: [0, 250, 500, 750], delaysMs: [250, 250, 250, 250] })
  })

  it('spends the hold on the closing frame rather than on copies of it', () => {
    expect(planTimeline(1_000, 4, 1_000).delaysMs).toEqual([250, 250, 250, 1_250])
  })

  it('rounds each display time to the GIF timing quantum', () => {
    expect(planTimeline(1_000, 3, 0).delaysMs).toEqual([330, 330, 330])
  })

  it('never holds a frame for less than the shortest a viewer honours', () => {
    expect(planTimeline(100, 60, 0).delaysMs.every((delay) => delay >= 20)).toBe(true)
  })

  it('draws at least one frame of a timeline with no length', () => {
    expect(planTimeline(0, 10, 500)).toEqual({ atMs: [0], delaysMs: [500] })
  })
})
