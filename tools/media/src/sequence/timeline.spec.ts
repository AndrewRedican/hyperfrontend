import type { MediaProfile } from '../models/profile'
import type { SequenceSegment } from '../models/sequence'
import { describe, expect, it } from '@hyperfrontend/testing'
import { chaptersAt, DEFAULT_TRANSITION_MS, placeSegments, railPosition, transitionOf } from './timeline'

const profile: MediaProfile = { id: 'test', intent: 'tests', width: 640, height: 360, scale: 1, fps: 10 }

/**
 * A chapter that runs for a stated time and draws nothing.
 *
 * @param label - The chapter's label.
 * @param durationMs - How long its timeline runs.
 * @param holdMs - How long it rests on its last frame.
 * @returns The chapter.
 */
function segment(label: string, durationMs: number, holdMs?: number): SequenceSegment {
  return { label, durationMs: () => durationMs, styles: () => '', frame: () => '', ...(holdMs === undefined ? {} : { holdMs }) }
}

describe('transitionOf', () => {
  it('falls back to the default transition', () => {
    expect(transitionOf({ segments: [] })).toBe(DEFAULT_TRANSITION_MS)
  })

  it('takes the transition the scene names', () => {
    expect(transitionOf({ segments: [], transitionMs: 0 })).toBe(0)
  })
})

describe('placeSegments', () => {
  it('places one chapter at the start of the timeline', () => {
    expect(placeSegments({ segments: [segment('only', 1_000)] }, profile)).toEqual([
      expect.objectContaining({ startMs: 0, durationMs: 1_000, endMs: 1_000 }),
    ])
  })

  it('counts a hold into the chapter but no transition after the last one', () => {
    expect(placeSegments({ segments: [segment('only', 1_000, 400)] }, profile)).toEqual([expect.objectContaining({ endMs: 1_400 })])
  })

  it('places chapters in the order given, one transition apart', () => {
    const placed = placeSegments(
      { segments: [segment('a', 1_000), segment('b', 2_000, 300), segment('c', 500)], transitionMs: 500 },
      profile
    )
    expect(placed.map((placement) => [placement.segment.label, placement.startMs, placement.endMs])).toEqual([
      ['a', 0, 1_000],
      ['b', 1_500, 3_800],
      ['c', 4_300, 4_800],
    ])
  })

  it('hands each chapter the profile it is composed against', () => {
    const seen: MediaProfile[] = []
    const spy: SequenceSegment = { label: 'spy', durationMs: (given) => seen.push(given) && 100, styles: () => '', frame: () => '' }
    placeSegments({ segments: [spy] }, profile)
    expect(seen).toEqual([profile])
  })

  it('rejects a sequence with no chapters', () => {
    expect(() => placeSegments({ segments: [] }, profile)).toThrow('A sequence needs at least one chapter')
  })

  it('rejects a negative transition', () => {
    expect(() => placeSegments({ segments: [segment('a', 100)], transitionMs: -1 }, profile)).toThrow(
      "A sequence's transition cannot be negative (got -1ms)"
    )
  })

  it('rejects a negative hold, naming the chapter', () => {
    expect(() => placeSegments({ segments: [segment('Detect', 100, -5)] }, profile)).toThrow(
      'Chapter "Detect" cannot hold for a negative time (got -5ms)'
    )
  })

  it('rejects a chapter reporting a negative duration, naming the chapter', () => {
    expect(() => placeSegments({ segments: [segment('Detect', -100)] }, profile)).toThrow(
      'Chapter "Detect" reports a negative duration (-100ms)'
    )
  })
})

describe('chaptersAt', () => {
  const placements = placeSegments({ segments: [segment('a', 1_000), segment('b', 1_000, 200)], transitionMs: 500 }, profile)

  it('draws nothing before the first chapter starts', () => {
    expect(chaptersAt(placements, 500, -1)).toEqual([])
  })

  it('draws only the running chapter at its own offset', () => {
    expect(chaptersAt(placements, 500, 400)).toEqual([{ index: 0, segment: placements[0]?.segment, localMs: 400, shift: 0, opacity: 1 }])
  })

  it('draws both chapters halfway through the move, one leaving and one arriving', () => {
    expect(chaptersAt(placements, 500, 1_250)).toEqual([
      { index: 0, segment: placements[0]?.segment, localMs: 1_000, shift: -0.09, opacity: 0.5 },
      { index: 1, segment: placements[1]?.segment, localMs: 0, shift: 0.5, opacity: 0.5 },
    ])
  })

  it('eases the move so it starts gently', () => {
    expect(chaptersAt(placements, 500, 1_125).map((frame) => frame.opacity)).toEqual([0.875, 0.125])
  })

  it('hands the incoming chapter over whole once the move has ended', () => {
    expect(chaptersAt(placements, 500, 1_500)).toEqual([{ index: 1, segment: placements[1]?.segment, localMs: 0, shift: 0, opacity: 1 }])
  })

  it('holds the last chapter on its final frame past the end of its timeline', () => {
    expect(chaptersAt(placements, 500, 9_000)).toEqual([
      { index: 1, segment: placements[1]?.segment, localMs: 1_000, shift: 0, opacity: 1 },
    ])
  })

  it('cuts straight from one chapter to the next when the transition is zero', () => {
    const cut = placeSegments({ segments: [segment('a', 1_000), segment('b', 1_000)], transitionMs: 0 }, profile)
    expect(chaptersAt(cut, 0, 1_000)).toEqual([{ index: 1, segment: cut[1]?.segment, localMs: 0, shift: 0, opacity: 1 }])
  })
})

describe('railPosition', () => {
  const placements = placeSegments({ segments: [segment('a', 1_000), segment('b', 1_000)], transitionMs: 500 }, profile)

  it('points at the first chapter before anything has started', () => {
    expect(railPosition(placements, -50)).toEqual({ current: 0, progress: 0 })
  })

  it('measures progress through the running chapter', () => {
    expect(railPosition(placements, 250)).toEqual({ current: 0, progress: 0.25 })
  })

  it('keeps pointing at the outgoing chapter, full, while the move runs', () => {
    expect(railPosition(placements, 1_250)).toEqual({ current: 0, progress: 1 })
  })

  it('moves to the next chapter once it starts', () => {
    expect(railPosition(placements, 1_500)).toEqual({ current: 1, progress: 0 })
  })

  it('reports an empty rail as the start', () => {
    expect(railPosition([], 500)).toEqual({ current: 0, progress: 0 })
  })
})
