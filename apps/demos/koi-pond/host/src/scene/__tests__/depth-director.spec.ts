import { describe, expect, it } from 'vitest'
import { DEPTH_COOLDOWN_MS, DEPTH_TRANSITION_MS, KOI_FRAMEWORKS, SURFACE_DEPTH } from '@hyperfrontend/demo-koi-lib'
import { createDepthDirector } from '../depth-director'

/** Host clock reading the shoal opens at. */
const OPEN_AT = 10_000

/** A moment well past every cooldown. */
const LATER = OPEN_AT + DEPTH_COOLDOWN_MS * 2

describe('opening the shoal', () => {
  it('spreads the koi across the whole water column', () => {
    const director = createDepthDirector(OPEN_AT)
    const levels = KOI_FRAMEWORKS.map((framework) => director.settledLevel(framework))
    // why: With more koi than levels every level is taken and the overflow doubles up; distinctness can only ever reach the column's own depth count.
    expect(new Set(levels).size).toBe(Math.min(KOI_FRAMEWORKS.length, SURFACE_DEPTH + 1))
  })

  it('puts one koi on the pond floor', () => {
    const director = createDepthDirector(OPEN_AT)
    expect(Math.min(...KOI_FRAMEWORKS.map((framework) => director.settledLevel(framework)))).toBe(0)
  })

  it('puts one koi just under the surface', () => {
    const director = createDepthDirector(OPEN_AT)
    expect(Math.max(...KOI_FRAMEWORKS.map((framework) => director.settledLevel(framework)))).toBe(SURFACE_DEPTH)
  })
})

describe('requests', () => {
  it('refuses a koi that only just took its level', () => {
    const director = createDepthDirector(OPEN_AT)
    expect(director.request('lit', 0, OPEN_AT + 10)).toBe(false)
  })

  it('grants a change once the cooldown is spent', () => {
    const director = createDepthDirector(OPEN_AT)
    expect(director.request('vanilla', SURFACE_DEPTH, LATER)).toBe(true)
  })

  it('refuses a second change while the first is still rolling', () => {
    const director = createDepthDirector(OPEN_AT)
    director.request('vanilla', SURFACE_DEPTH, LATER)
    expect(director.request('vanilla', 0, LATER + DEPTH_COOLDOWN_MS * 2)).toBe(false)
  })

  it('refuses a request for the level the koi already holds', () => {
    const director = createDepthDirector(OPEN_AT)
    expect(director.request('vanilla', director.settledLevel('vanilla'), LATER)).toBe(false)
  })

  it('ignores a koi that is not in the shoal', () => {
    const director = createDepthDirector(OPEN_AT)
    // @ts-expect-error — the host must survive a relay naming a koi the pond does not have.
    expect(director.request('goldfish', 4, LATER)).toBe(false)
  })
})

describe('transitions', () => {
  it('tells a koi the level it is heading for, not the one it is leaving', () => {
    const director = createDepthDirector(OPEN_AT)
    director.request('vanilla', SURFACE_DEPTH, LATER)
    expect(director.settledLevel('vanilla')).toBe(SURFACE_DEPTH)
  })

  it('renders the koi between levels while it rolls', () => {
    const director = createDepthDirector(OPEN_AT)
    const from = director.settledLevel('vanilla')
    director.request('vanilla', SURFACE_DEPTH, LATER)
    const mid = director.levelOf('vanilla', LATER + DEPTH_TRANSITION_MS / 2)
    expect(mid > from && mid < SURFACE_DEPTH).toBe(true)
  })

  it('reports the koi that just finished rolling', () => {
    const director = createDepthDirector(OPEN_AT)
    director.request('vanilla', SURFACE_DEPTH, LATER)
    expect(director.advance(LATER + DEPTH_TRANSITION_MS)).toEqual(['vanilla'])
  })

  it('reports nothing while every koi is still settled', () => {
    const director = createDepthDirector(OPEN_AT)
    expect(director.advance(LATER)).toEqual([])
  })

  it('reports a koi only once for one transition', () => {
    const director = createDepthDirector(OPEN_AT)
    director.request('vanilla', SURFACE_DEPTH, LATER)
    director.advance(LATER + DEPTH_TRANSITION_MS)
    expect(director.advance(LATER + DEPTH_TRANSITION_MS + 100)).toEqual([])
  })

  it('lets a koi change again once the roll and the cooldown are both spent', () => {
    const director = createDepthDirector(OPEN_AT)
    director.request('vanilla', SURFACE_DEPTH, LATER)
    const settledAt = LATER + DEPTH_TRANSITION_MS
    director.advance(settledAt)
    expect(director.request('vanilla', 0, settledAt + DEPTH_COOLDOWN_MS)).toBe(true)
  })
})

describe('unknown koi', () => {
  it('reads as the pond floor rather than throwing', () => {
    // @ts-expect-error — the host must survive a relay naming a koi the pond does not have.
    expect(createDepthDirector(OPEN_AT).levelOf('goldfish', OPEN_AT)).toBe(0)
  })
})
