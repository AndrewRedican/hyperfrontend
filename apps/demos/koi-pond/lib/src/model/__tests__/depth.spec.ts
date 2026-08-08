import { describe, expect, it } from 'vitest'
import {
  DEPTH_COOLDOWN_MS,
  DEPTH_TRANSITION_MS,
  PASSING_SEPARATION,
  SURFACE_DEPTH,
  advanceDepth,
  beginDepthChange,
  canPass,
  depthBlur,
  depthFraction,
  depthOpacity,
  depthScale,
  depthZIndex,
  grantsDepth,
  mayRipple,
  renderedDepth,
  spreadDepths,
  startDepth,
} from '../depth.js'

describe('depthFraction', () => {
  it('reads nothing at the pond floor', () => {
    expect(depthFraction(0)).toBe(0)
  })

  it('reads full at the surface', () => {
    expect(depthFraction(SURFACE_DEPTH)).toBe(1)
  })

  it('clamps a level below the floor', () => {
    expect(depthFraction(-4)).toBe(0)
  })

  it('clamps a level above the surface', () => {
    expect(depthFraction(40)).toBe(1)
  })

  it('reads fractionally mid-transition', () => {
    expect(depthFraction(3)).toBeCloseTo(0.5)
  })
})

describe('depthScale', () => {
  it('renders a surface koi at full size', () => {
    expect(depthScale(SURFACE_DEPTH)).toBe(1)
  })

  it('shrinks a koi on the pond floor', () => {
    expect(depthScale(0)).toBeLessThan(1)
  })

  it('grows monotonically toward the light', () => {
    expect(depthScale(4)).toBeGreaterThan(depthScale(2))
  })
})

describe('depthOpacity', () => {
  it('shows a surface koi in full', () => {
    expect(depthOpacity(SURFACE_DEPTH)).toBe(1)
  })

  it('veils a koi on the pond floor', () => {
    expect(depthOpacity(0)).toBeLessThan(depthOpacity(SURFACE_DEPTH))
  })

  it('keeps the deepest koi readable rather than a ghost', () => {
    expect(depthOpacity(0)).toBeGreaterThan(0.5)
  })
})

describe('depthBlur', () => {
  it('leaves a surface koi in focus', () => {
    expect(depthBlur(SURFACE_DEPTH)).toBe(0)
  })

  it('softens a koi on the pond floor', () => {
    expect(depthBlur(0)).toBeGreaterThan(0)
  })
})

describe('depthZIndex', () => {
  it('stacks a deeper koi under a shallower one', () => {
    expect(depthZIndex(1)).toBeLessThan(depthZIndex(5))
  })

  it('keeps every koi above the pond floor', () => {
    expect(depthZIndex(0)).toBeGreaterThan(0)
  })

  it('rounds a koi mid-transition onto a whole layer', () => {
    expect(depthZIndex(2.6)).toBe(depthZIndex(3))
  })
})

describe('mayRipple', () => {
  it('lets the koi just under the surface break it', () => {
    expect(mayRipple(SURFACE_DEPTH)).toBe(true)
  })

  it('keeps a deeper koi from reaching the surface', () => {
    expect(mayRipple(SURFACE_DEPTH - 1)).toBe(false)
  })
})

describe('canPass', () => {
  it('lets two koi separated by the passing gap cross freely', () => {
    expect(canPass(1, 1 + PASSING_SEPARATION)).toBe(true)
  })

  it('makes two koi one level apart sort it out between them', () => {
    expect(canPass(3, 4)).toBe(false)
  })
})

describe('grantsDepth', () => {
  it('refuses a change while the koi is still settling into its level', () => {
    expect(grantsDepth(startDepth(3, 0), 5, DEPTH_COOLDOWN_MS - 1)).toBe(false)
  })

  it('grants a change once the cooldown is spent', () => {
    expect(grantsDepth(startDepth(3, 0), 5, DEPTH_COOLDOWN_MS)).toBe(true)
  })

  it('refuses a change while another is already in flight', () => {
    const moving = beginDepthChange(startDepth(3, 0), 5, DEPTH_COOLDOWN_MS)
    expect(grantsDepth(moving, 1, DEPTH_COOLDOWN_MS * 4)).toBe(false)
  })

  it('refuses a request that does not actually move the koi', () => {
    expect(grantsDepth(startDepth(3, 0), 3, DEPTH_COOLDOWN_MS * 4)).toBe(false)
  })

  it('refuses a request that only clamps back onto the level already held', () => {
    expect(grantsDepth(startDepth(SURFACE_DEPTH, 0), 99, DEPTH_COOLDOWN_MS * 4)).toBe(false)
  })
})

describe('advanceDepth', () => {
  it('leaves a settled koi where it is', () => {
    const settled = startDepth(3, 0)
    expect(advanceDepth(settled, 90_000)).toBe(settled)
  })

  it('holds the transition until it has run its course', () => {
    const moving = beginDepthChange(startDepth(3, 0), 5, 0)
    expect(advanceDepth(moving, DEPTH_TRANSITION_MS - 1).target).toBe(5)
  })

  it('settles the koi onto its new level once the roll finishes', () => {
    const moving = beginDepthChange(startDepth(3, 0), 5, 0)
    expect(advanceDepth(moving, DEPTH_TRANSITION_MS)).toEqual({ level: 5, target: null, since: DEPTH_TRANSITION_MS })
  })
})

describe('renderedDepth', () => {
  it('reports the held level for a settled koi', () => {
    expect(renderedDepth(startDepth(4, 0), 5000)).toBe(4)
  })

  it('starts a transition at the level being left', () => {
    expect(renderedDepth(beginDepthChange(startDepth(2, 0), 4, 0), 0)).toBe(2)
  })

  it('finishes a transition at the level being taken', () => {
    expect(renderedDepth(beginDepthChange(startDepth(2, 0), 4, 0), DEPTH_TRANSITION_MS)).toBe(4)
  })

  it('sits between the two levels halfway through', () => {
    expect(renderedDepth(beginDepthChange(startDepth(2, 0), 4, 0), DEPTH_TRANSITION_MS / 2)).toBeCloseTo(3)
  })

  it('eases in rather than jumping off the level it is leaving', () => {
    const rolling = beginDepthChange(startDepth(0, 0), 6, 0)
    expect(renderedDepth(rolling, DEPTH_TRANSITION_MS * 0.1)).toBeLessThan(0.6)
  })
})

describe('spreadDepths', () => {
  it('spans the whole water column for a full shoal', () => {
    expect(spreadDepths(7)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('reaches both the floor and the surface with a small shoal', () => {
    expect(spreadDepths(3)).toEqual([0, 3, 6])
  })

  it('puts a lone koi where a visitor will see it', () => {
    expect(spreadDepths(1)).toEqual([SURFACE_DEPTH])
  })

  it('has nothing to place for an empty pond', () => {
    expect(spreadDepths(0)).toEqual([])
  })
})
