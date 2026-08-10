import type { KoiOutline } from '../../model/types.js'
import { describe, expect, it } from 'vitest'
import {
  boundsOverlap,
  chainBounds,
  chainGap,
  nearestSpinePoint,
  outlineContains,
  pointSegmentDistance,
  signedDistanceToChain,
} from '../capsule.js'

/**
 * Builds an outline lying along the x axis, nose at the origin.
 *
 * @param y - Vertical offset of the whole body.
 * @param width - Half-width at every sample.
 * @returns The outline.
 */
function bar(y = 0, width = 10): KoiOutline {
  return {
    framework: 'vanilla',
    spine: [
      { x: 0, y },
      { x: 50, y },
      { x: 100, y },
    ],
    girth: [width, width, width],
    heading: 0,
    speed: 100,
    depth: 3,
    phase: 'relaxed',
  }
}

describe('pointSegmentDistance', () => {
  it('measures straight out from the middle of a segment', () => {
    expect(pointSegmentDistance({ x: 50, y: 30 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe(30)
  })

  it('measures to the nearer end when the point is past the segment', () => {
    expect(pointSegmentDistance({ x: 130, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe(30)
  })

  it('measures to the start when the point is behind the segment', () => {
    expect(pointSegmentDistance({ x: -30, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe(30)
  })

  it('treats a segment of no length as its own endpoint', () => {
    expect(pointSegmentDistance({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5)
  })
})

describe('signedDistanceToChain', () => {
  const body = bar()

  it('reads negative inside the fish', () => {
    expect(signedDistanceToChain({ x: 50, y: 0 }, body.spine, body.girth)).toBe(-10)
  })

  it('reads zero on the skin', () => {
    expect(signedDistanceToChain({ x: 50, y: 10 }, body.spine, body.girth)).toBe(0)
  })

  it('reads positive in open water', () => {
    expect(signedDistanceToChain({ x: 50, y: 40 }, body.spine, body.girth)).toBe(30)
  })

  it('handles a chain thinned all the way down to one sample', () => {
    expect(signedDistanceToChain({ x: 0, y: 25 }, [{ x: 0, y: 0 }], [10])).toBe(15)
  })

  it('reports open water for an empty chain', () => {
    expect(signedDistanceToChain({ x: 0, y: 0 }, [], [])).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('outlineContains', () => {
  it('accepts a point on the body', () => {
    expect(outlineContains({ x: 20, y: 4 }, bar())).toBe(true)
  })

  it('rejects a point off the body', () => {
    expect(outlineContains({ x: 20, y: 40 }, bar())).toBe(false)
  })

  it('accepts a near miss once slack makes a small koi easy to hover', () => {
    expect(outlineContains({ x: 20, y: 18 }, bar(), 10)).toBe(true)
  })
})

describe('chainBounds', () => {
  it('pads the box by the half-width on every edge', () => {
    expect(chainBounds(bar().spine, bar().girth)).toEqual({ left: -10, top: -10, right: 110, bottom: 10 })
  })

  it('collapses to the origin for an empty chain', () => {
    expect(chainBounds([], [])).toEqual({ left: 0, top: 0, right: 0, bottom: 0 })
  })
})

describe('boundsOverlap', () => {
  const left = { left: 0, top: 0, right: 50, bottom: 50 }

  it('sees two boxes sharing space', () => {
    expect(boundsOverlap(left, { left: 40, top: 40, right: 90, bottom: 90 })).toBe(true)
  })

  it('separates two boxes that do not touch', () => {
    expect(boundsOverlap(left, { left: 60, top: 0, right: 90, bottom: 50 })).toBe(false)
  })

  it('brings a near miss into range once padded', () => {
    expect(boundsOverlap(left, { left: 60, top: 0, right: 90, bottom: 50 }, 6)).toBe(true)
  })
})

describe('chainGap', () => {
  it('measures the water between two parallel bodies', () => {
    expect(chainGap(bar(0), bar(50))).toBe(30)
  })

  it('reads negative where two bodies overlap', () => {
    expect(chainGap(bar(0), bar(15))).toBeLessThan(0)
  })
})

describe('nearestSpinePoint', () => {
  it('picks the sample closest to the probe', () => {
    expect(nearestSpinePoint({ x: 95, y: 5 }, bar().spine)).toEqual({ x: 100, y: 0 })
  })

  it('has nothing to offer for an empty chain', () => {
    expect(nearestSpinePoint({ x: 0, y: 0 }, [])).toBeNull()
  })
})
