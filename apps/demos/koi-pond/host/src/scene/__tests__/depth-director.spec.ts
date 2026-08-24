import type { KoiInstanceId } from '../instance-id'
import { describe, expect, it } from 'vitest'
import { DEPTH_COOLDOWN_MS, DEPTH_TRANSITION_MS, KOI_FRAMEWORKS, SURFACE_DEPTH, spreadDepths } from '@hyperfrontend/demo-koi-lib'
import { createDepthDirector } from '../depth-director'
import { koiInstanceId } from '../instance-id'

/** Host clock reading the shoal opens at. */
const OPEN_AT = 10_000

/** A moment well past every cooldown. */
const LATER = OPEN_AT + DEPTH_COOLDOWN_MS * 2

/** The canonical eight, one instance apiece, in the pond's own order. */
const EIGHT: KoiInstanceId[] = KOI_FRAMEWORKS.map((framework) => koiInstanceId(framework, 0))

/** A twelve-koi roster: the canonical eight plus four twins. */
const TWELVE: KoiInstanceId[] = [...EIGHT, ...KOI_FRAMEWORKS.slice(0, 4).map((framework) => koiInstanceId(framework, 1))]

/**
 * Opens a shoal one koi at a time and lets every re-dealt glide settle.
 *
 * @param ids - The roster, in joining order.
 * @returns The director with the whole roster settled.
 */
function shoalOf(ids: readonly KoiInstanceId[]) {
  const director = createDepthDirector()
  for (const id of ids) {
    director.add(id, OPEN_AT)
  }
  director.advance(OPEN_AT + DEPTH_TRANSITION_MS)
  return director
}

describe('the spread', () => {
  it('derives from the living roster, not the framework count', () => {
    const rosters = [EIGHT.slice(0, 1), EIGHT.slice(0, 3), EIGHT, TWELVE]
    for (const ids of rosters) {
      const director = shoalOf(ids)
      expect(ids.map((id) => director.settledLevel(id))).toEqual(spreadDepths(ids.length))
    }
  })

  it('puts a lone koi just under the surface', () => {
    const director = shoalOf(EIGHT.slice(0, 1))
    // why: A solo koi pinned at a canonical slot in the deep — dim, blurred, and refused ripples — was the bug; the live-roster spread is the fix.
    expect(director.settledLevel('vanilla:0')).toBe(SURFACE_DEPTH)
  })

  it('spans the whole column with eight koi', () => {
    const director = shoalOf(EIGHT)
    const levels = EIGHT.map((id) => director.settledLevel(id))
    expect([Math.min(...levels), Math.max(...levels)]).toEqual([0, SURFACE_DEPTH])
  })

  it('doubles levels up past a full column', () => {
    const director = shoalOf(TWELVE)
    const levels = TWELVE.map((id) => director.settledLevel(id))
    // why: Twelve koi over seven levels must share; distinctness can only ever reach the column's own depth count.
    expect(new Set(levels).size).toBe(SURFACE_DEPTH + 1)
  })
})

describe('joining and leaving', () => {
  it('re-deals the whole spread when a koi joins', () => {
    const director = shoalOf(EIGHT.slice(0, 1))
    director.add('react:0', LATER)
    expect([director.settledLevel('vanilla:0'), director.settledLevel('react:0')]).toEqual(spreadDepths(2))
  })

  it('names the koi whose slots moved with the re-deal', () => {
    const director = shoalOf(EIGHT.slice(0, 1))
    // why: The solo koi held the surface; a second fish re-deals it to the floor slot, and the pond must be told to restack it.
    expect(director.add('react:0', LATER)).toEqual(['vanilla:0'])
  })

  it('re-deals the remainder when a koi leaves', () => {
    const director = shoalOf(EIGHT.slice(0, 3))
    director.remove('vue:0', LATER)
    director.advance(LATER + DEPTH_TRANSITION_MS)
    expect([director.settledLevel('vanilla:0'), director.settledLevel('react:0')]).toEqual(spreadDepths(2))
  })

  it('promotes a survivor to the surface when the surface koi leaves', () => {
    const director = shoalOf(EIGHT.slice(0, 2))
    director.remove('react:0', LATER)
    expect(director.settledLevel('vanilla:0')).toBe(SURFACE_DEPTH)
  })

  it('has nothing to re-deal for a koi it never held', () => {
    expect(shoalOf(EIGHT).remove('vanilla:3', LATER)).toEqual([])
  })
})

describe('requests', () => {
  it('refuses a koi that only just took its level', () => {
    const director = shoalOf(EIGHT)
    expect(director.request('lit:0', 0, OPEN_AT + DEPTH_TRANSITION_MS + 10)).toBe(false)
  })

  it('grants a change once the cooldown is spent', () => {
    const director = shoalOf(EIGHT)
    expect(director.request('vanilla:0', SURFACE_DEPTH, LATER)).toBe(true)
  })

  it('refuses a second change while the first is still rolling', () => {
    const director = shoalOf(EIGHT)
    director.request('vanilla:0', SURFACE_DEPTH, LATER)
    expect(director.request('vanilla:0', 0, LATER + DEPTH_COOLDOWN_MS * 2)).toBe(false)
  })

  it('refuses a request for the level the koi already holds', () => {
    const director = shoalOf(EIGHT)
    expect(director.request('vanilla:0', director.settledLevel('vanilla:0'), LATER)).toBe(false)
  })

  it('ignores a koi that is not in the shoal', () => {
    const director = shoalOf(EIGHT)
    expect(director.request('vanilla:3', 4, LATER)).toBe(false)
  })
})

describe('transitions', () => {
  it('tells a koi the level it is heading for, not the one it is leaving', () => {
    const director = shoalOf(EIGHT)
    director.request('vanilla:0', SURFACE_DEPTH, LATER)
    expect(director.settledLevel('vanilla:0')).toBe(SURFACE_DEPTH)
  })

  it('renders the koi between levels while it rolls', () => {
    const director = shoalOf(EIGHT)
    const from = director.settledLevel('vanilla:0')
    director.request('vanilla:0', SURFACE_DEPTH, LATER)
    const mid = director.levelOf('vanilla:0', LATER + DEPTH_TRANSITION_MS / 2)
    expect(mid > from && mid < SURFACE_DEPTH).toBe(true)
  })

  it('reports the koi that just finished rolling', () => {
    const director = shoalOf(EIGHT)
    director.request('vanilla:0', SURFACE_DEPTH, LATER)
    expect(director.advance(LATER + DEPTH_TRANSITION_MS)).toEqual(['vanilla:0'])
  })

  it('reports nothing while every koi is still settled', () => {
    const director = shoalOf(EIGHT)
    expect(director.advance(LATER)).toEqual([])
  })

  it('reports a koi only once for one transition', () => {
    const director = shoalOf(EIGHT)
    director.request('vanilla:0', SURFACE_DEPTH, LATER)
    director.advance(LATER + DEPTH_TRANSITION_MS)
    expect(director.advance(LATER + DEPTH_TRANSITION_MS + 100)).toEqual([])
  })

  it('lets a koi change again once the roll and the cooldown are both spent', () => {
    const director = shoalOf(EIGHT)
    director.request('vanilla:0', SURFACE_DEPTH, LATER)
    const settledAt = LATER + DEPTH_TRANSITION_MS
    director.advance(settledAt)
    expect(director.request('vanilla:0', 0, settledAt + DEPTH_COOLDOWN_MS)).toBe(true)
  })
})

describe('unknown koi', () => {
  it('reads as the pond floor rather than throwing', () => {
    expect(createDepthDirector().levelOf('vanilla:0', OPEN_AT)).toBe(0)
  })
})
