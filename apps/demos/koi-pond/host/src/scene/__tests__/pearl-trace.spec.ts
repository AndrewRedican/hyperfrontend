import type { Vec2 } from '@hyperfrontend/demo-koi-lib'
import { describe, expect, it } from 'vitest'
import { PEARL_HORIZON_ALPHA, PEARL_MAX, PEARL_NOSE_ALPHA, PEARL_TOLERANCE_PX, advanceTrace, pearlAlpha } from '../pearl-trace'

/** How far apart a fixture koi's own reported path points sit, in pond pixels. */
const STEP_PX = 15

/** How far apart these fixtures lay their pearls, in pond pixels. */
const SPACING_PX = 28

/** How far a full fixture chain reaches, in pond pixels. */
const REACH_PX = SPACING_PX * PEARL_MAX

/** How many points a koi's report carries, which is the cap the producer enforces. */
const REPORTED_POINTS = 20

/** Where every fixture koi's nose starts. */
const NOSE: Vec2 = { x: 0, y: 0 }

/** The heading every fixture koi swims on: along +x, so a spec reading an x is reading an arc length. */
const HEADING = 0

/** How far along its run a kinked fixture path turns, in pond pixels. */
const KINK_PX = 150

/** How many pearls of a full chain a kink at {@link KINK_PX} leaves standing. */
const KEPT = 5

/**
 * A koi's reported advancement: a straight run along its heading.
 *
 * @param from - The koi's nose, in pond space.
 * @param points - How many points the koi reports.
 * @returns The path, nearest first.
 */
function straight(from: Vec2, points: number): Vec2[] {
  return Array.from({ length: points }, (_unused, index) => ({ x: from.x + STEP_PX * (index + 1), y: from.y }))
}

/**
 * A koi's reported advancement, turning part of the way through: the shape of a manoeuvre taken mid-horizon.
 *
 * @param from - The koi's nose, in pond space.
 * @param turnAfterPx - How far along the run the path turns, in pond pixels.
 * @returns The path, nearest first.
 */
function kinked(from: Vec2, turnAfterPx: number): Vec2[] {
  const path: Vec2[] = []
  let point = { ...from }
  for (let index = 0; index < REPORTED_POINTS; index += 1) {
    const turned = point.x - from.x >= turnAfterPx
    point = turned ? { x: point.x + STEP_PX * Math.SQRT1_2, y: point.y + STEP_PX * Math.SQRT1_2 } : { x: point.x + STEP_PX, y: point.y }
    path.push(point)
  }
  return path
}

/**
 * The same advancement nudged sideways: a fresh report that agrees with the last without repeating it.
 *
 * @param path - The reported path.
 * @param offsetPx - How far to nudge it, in pond pixels.
 * @returns The nudged path.
 */
function nudged(path: readonly Vec2[], offsetPx: number): Vec2[] {
  return path.map((point) => ({ x: point.x, y: point.y + offsetPx }))
}

/**
 * How far along its run each pearl of a chain sits, past the last place this arithmetic is exact.
 *
 * @param chain - The pearls.
 * @returns One arc length per pearl, in pond pixels.
 */
function arcs(chain: readonly Vec2[]): number[] {
  return chain.map((pearl) => Number(pearl.x.toFixed(6)))
}

/** A full chain laid from a standing start along a straight report. */
function laid(): Vec2[] {
  return advanceTrace([], NOSE, HEADING, straight(NOSE, REPORTED_POINTS), SPACING_PX)
}

describe('advanceTrace', () => {
  it('lays its first pearl one spacing ahead of the nose', () => {
    expect(laid()[0]).toEqual({ x: SPACING_PX, y: 0 })
  })

  it('lays every pearl one spacing further out than the one before it', () => {
    expect(arcs(laid())).toEqual(Array.from({ length: PEARL_MAX }, (_unused, index) => SPACING_PX * (index + 1)))
  })

  it('lays no more pearls than the chain may carry', () => {
    expect(advanceTrace([], NOSE, HEADING, straight(NOSE, 40), SPACING_PX)).toHaveLength(PEARL_MAX)
  })

  it('reads no more of the report than the wire may carry', () => {
    expect(arcs(advanceTrace([], NOSE, HEADING, straight(NOSE, 40), 40))).toEqual([40, 80, 120, 160, 200, 240, 280])
  })

  it('swallows the pearl the nose has reached and mints one at the horizon', () => {
    const swum = { x: SPACING_PX, y: 0 }
    expect(arcs(advanceTrace(laid(), swum, HEADING, straight(swum, REPORTED_POINTS), SPACING_PX))).toEqual(
      Array.from({ length: PEARL_MAX }, (_unused, index) => SPACING_PX * (index + 2))
    )
  })

  it('swallows every pearl the nose has swum past', () => {
    const swum = { x: SPACING_PX * 3, y: 0 }
    expect(arcs(advanceTrace(laid(), swum, HEADING, straight(swum, REPORTED_POINTS), SPACING_PX))[0]).toBe(SPACING_PX * 4)
  })

  it('never carries more than a full chain however long the koi swims', () => {
    let chain = laid()
    let most = chain.length
    for (let tick = 1; tick <= 40; tick += 1) {
      const swum = { x: tick * 7, y: 0 }
      chain = advanceTrace(chain, swum, HEADING, straight(swum, REPORTED_POINTS), SPACING_PX)
      most = Math.max(most, chain.length)
    }
    expect(most).toBe(PEARL_MAX)
  })

  it('carries a surviving pearl into the next tick as the very object it laid', () => {
    const chain = laid()
    const swum = { x: SPACING_PX, y: 0 }
    expect(
      advanceTrace(chain, swum, HEADING, straight(swum, REPORTED_POINTS), SPACING_PX).filter((pearl) => chain.includes(pearl))
    ).toEqual(chain.slice(1))
  })

  it('never moves a pearl once it is laid, however many reports pass over it', () => {
    let chain = laid()
    const watched = chain[PEARL_MAX - 1] ?? NOSE
    const placed = { ...watched }
    for (let tick = 1; tick <= 4; tick += 1) {
      const swum = { x: tick * 7, y: 0 }
      chain = advanceTrace(chain, swum, HEADING, straight(swum, REPORTED_POINTS), SPACING_PX)
    }
    expect(chain.find((pearl) => pearl === watched)).toEqual(placed)
  })

  it('re-lays nothing while the fresh report agrees within tolerance', () => {
    const chain = laid()
    const agreeing = nudged(straight(NOSE, REPORTED_POINTS), PEARL_TOLERANCE_PX - 1)
    expect(advanceTrace(chain, NOSE, HEADING, agreeing, SPACING_PX).map((pearl) => chain.includes(pearl))).toEqual(
      Array.from({ length: PEARL_MAX }, () => true)
    )
  })

  it('keeps every pearl a replanned manoeuvre still runs through', () => {
    const chain = laid()
    expect(advanceTrace(chain, NOSE, HEADING, kinked(NOSE, KINK_PX), SPACING_PX).filter((pearl) => chain.includes(pearl))).toEqual(
      chain.slice(0, KEPT)
    )
  })

  it('re-lays the contradicted suffix on the new manoeuvre in the same tick', () => {
    const suffix = advanceTrace(laid(), NOSE, HEADING, kinked(NOSE, KINK_PX), SPACING_PX).slice(KEPT)
    expect(suffix.map((pearl) => Number((pearl.x - pearl.y).toFixed(6)))).toEqual(Array.from({ length: PEARL_MAX - KEPT }, () => KINK_PX))
  })

  it('leaves no contradicted pearl in the water', () => {
    const chain = laid()
    expect(advanceTrace(chain, NOSE, HEADING, kinked(NOSE, KINK_PX), SPACING_PX).filter((pearl) => chain.indexOf(pearl) >= KEPT)).toEqual(
      []
    )
  })

  it('lays nothing for a koi reporting no advancement', () => {
    expect(advanceTrace([], NOSE, HEADING, [], SPACING_PX)).toEqual([])
  })

  it('drops the chain it was carrying when a koi stops reporting its advancement', () => {
    expect(advanceTrace(laid(), NOSE, HEADING, [], SPACING_PX)).toEqual([])
  })

  it('lays nothing for a koi reporting no body to space its pearls by', () => {
    expect(advanceTrace([], NOSE, HEADING, straight(NOSE, REPORTED_POINTS), 0)).toEqual([])
  })
})

describe('pearlAlpha', () => {
  it('carries its whole ink against the nose', () => {
    expect(pearlAlpha(0, REACH_PX)).toBeCloseTo(PEARL_NOSE_ALPHA)
  })

  it('has next to nothing left of it at the horizon', () => {
    expect(pearlAlpha(REACH_PX, REACH_PX)).toBeCloseTo(PEARL_HORIZON_ALPHA)
  })

  it('thins with every pixel between the two', () => {
    const ramp = Array.from({ length: 20 }, (_unused, index) => pearlAlpha((REACH_PX * index) / 19, REACH_PX))
    expect(ramp).toEqual([...ramp].sort((first, second) => second - first))
  })

  it('never thins past the horizon', () => {
    expect(pearlAlpha(REACH_PX * 2, REACH_PX)).toBeCloseTo(PEARL_HORIZON_ALPHA)
  })
})
