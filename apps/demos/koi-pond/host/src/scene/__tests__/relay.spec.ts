import type { KoiFramework, KoiOutline } from '@hyperfrontend/demo-koi-lib'
import { describe, expect, it } from 'vitest'
import { describePond } from '@hyperfrontend/demo-koi-lib'
import { createRelay } from '../relay'

/** The pond every fixture here swims in. */
const POND = describePond(1200, 800, 1200, 800, false)

/** The clock every fixture reports and reads at, so nothing is reckoned unless a spec says so. */
const NOW = 100_000

/**
 * Builds an outline lying along +x with its nose at a point.
 *
 * @param framework - Whose outline it is.
 * @param x - Nose x in pond space.
 * @param y - Nose y in pond space.
 * @param depth - The level it holds.
 * @returns The reported outline.
 */
function outlineAt(framework: KoiFramework, x: number, y: number, depth = 3): KoiOutline {
  return {
    framework,
    spine: [
      { x, y },
      { x: x - 50, y },
      { x: x - 100, y },
    ],
    girth: [8, 14, 5],
    heading: 0,
    speed: 60,
    depth,
    phase: 'relaxed',
  }
}

describe('recording', () => {
  it('starts with an empty pond', () => {
    expect(createRelay().outlines).toEqual([])
  })

  it('keeps one outline per koi rather than a history', () => {
    const relay = createRelay()
    relay.record('lit:0', outlineAt('lit', 100, 100), NOW)
    relay.record('lit:0', outlineAt('lit', 200, 100), NOW)
    expect(relay.outlines).toHaveLength(1)
  })

  it('keeps the latest report', () => {
    const relay = createRelay()
    relay.record('lit:0', outlineAt('lit', 100, 100), NOW)
    relay.record('lit:0', outlineAt('lit', 200, 100), NOW)
    expect(relay.outlines[0]?.spine[0]?.x).toBe(200)
  })

  it('forgets a koi whose session closed', () => {
    const relay = createRelay()
    relay.record('lit:0', outlineAt('lit', 100, 100), NOW)
    relay.forget('lit:0')
    expect(relay.outlines).toEqual([])
  })

  it('keeps twins of one framework as separate records', () => {
    const relay = createRelay()
    relay.record('lit:0', outlineAt('lit', 100, 100), NOW)
    relay.record('lit:1', outlineAt('lit', 300, 100), NOW)
    expect(relay.outlines).toHaveLength(2)
  })
})

describe('neighborsFor', () => {
  it('tells a koi about one swimming beside it', () => {
    const relay = createRelay()
    relay.record('lit:0', outlineAt('lit', 400, 400), NOW)
    relay.record('vue:0', outlineAt('vue', 470, 400), NOW)
    expect(relay.neighborsFor('lit:0', POND, NOW).map((entry) => entry.framework)).toEqual(['vue'])
  })

  it('never tells a koi about itself', () => {
    const relay = createRelay()
    relay.record('lit:0', outlineAt('lit', 400, 400), NOW)
    expect(relay.neighborsFor('lit:0', POND, NOW)).toEqual([])
  })

  it('filters out a koi too far away to matter', () => {
    const relay = createRelay()
    relay.record('lit:0', outlineAt('lit', 400, 400), NOW)
    relay.record('vue:0', outlineAt('vue', 400, 400 + POND.fishLength * 12), NOW)
    expect(relay.neighborsFor('lit:0', POND, NOW)).toEqual([])
  })

  it('reports the nearest neighbour first', () => {
    const relay = createRelay()
    relay.record('lit:0', outlineAt('lit', 400, 400), NOW)
    relay.record('vue:0', outlineAt('vue', 400, 400 + POND.fishLength * 2.5), NOW)
    relay.record('react:0', outlineAt('react', 400, 400 + POND.fishLength * 0.6), NOW)
    expect(relay.neighborsFor('lit:0', POND, NOW)[0]?.framework).toBe('react')
  })

  it('carries the course a koi steers around', () => {
    const relay = createRelay()
    relay.record('lit:0', outlineAt('lit', 400, 400), NOW)
    relay.record('vue:0', { ...outlineAt('vue', 470, 400), heading: 1.2, speed: 200 }, NOW)
    expect(relay.neighborsFor('lit:0', POND, NOW)[0]).toMatchObject({ heading: 1.2, speed: 200 })
  })

  it('measures the neighbour so a koi knows how much room to leave', () => {
    const relay = createRelay()
    relay.record('lit:0', outlineAt('lit', 400, 400), NOW)
    relay.record('vue:0', outlineAt('vue', 470, 400), NOW)
    expect(relay.neighborsFor('lit:0', POND, NOW)[0]?.length).toBeCloseTo(100)
  })

  it('has nothing to say about a koi that has not reported yet', () => {
    expect(createRelay().neighborsFor('solid:0', POND, NOW)).toEqual([])
  })

  it('tells a twin about its twin', () => {
    const relay = createRelay()
    relay.record('lit:0', outlineAt('lit', 400, 400), NOW)
    relay.record('lit:1', outlineAt('lit', 470, 400), NOW)
    expect(relay.neighborsFor('lit:0', POND, NOW)).toEqual([expect.objectContaining({ framework: 'lit', x: 470 })])
  })

  it('never reflects a twin back at itself however many share its framework', () => {
    const relay = createRelay()
    relay.record('lit:0', outlineAt('lit', 400, 400), NOW)
    relay.record('lit:1', outlineAt('lit', 470, 400), NOW)
    expect(relay.neighborsFor('lit:1', POND, NOW)).toEqual([expect.objectContaining({ x: 400 })])
  })
})

describe('pick', () => {
  it('finds the koi under the pointer', () => {
    const relay = createRelay()
    relay.record('svelte:0', outlineAt('svelte', 400, 400), NOW)
    expect(relay.pick({ x: 360, y: 402 }, POND, NOW)).toBe('svelte:0')
  })

  it('finds nothing over open water', () => {
    const relay = createRelay()
    relay.record('svelte:0', outlineAt('svelte', 400, 400), NOW)
    expect(relay.pick({ x: 900, y: 120 }, POND, NOW)).toBeNull()
  })

  it('picks the koi nearest the surface when two overlap', () => {
    const relay = createRelay()
    relay.record('svelte:0', outlineAt('svelte', 400, 400, 1), NOW)
    relay.record('preact:0', outlineAt('preact', 400, 400, 6), NOW)
    expect(relay.pick({ x: 360, y: 400 }, POND, NOW)).toBe('preact:0')
  })

  it('picks the closer body when two at one level overlap', () => {
    const relay = createRelay()
    relay.record('svelte:0', outlineAt('svelte', 400, 400, 4), NOW)
    relay.record('preact:0', outlineAt('preact', 400, 412, 4), NOW)
    expect(relay.pick({ x: 360, y: 399 }, POND, NOW)).toBe('svelte:0')
  })

  it('finds nothing in an empty pond', () => {
    expect(createRelay().pick({ x: 0, y: 0 }, POND, NOW)).toBeNull()
  })

  it('picks the exact twin under the pointer', () => {
    const relay = createRelay()
    relay.record('svelte:0', outlineAt('svelte', 400, 400, 4), NOW)
    relay.record('svelte:1', outlineAt('svelte', 400, 412, 4), NOW)
    expect(relay.pick({ x: 360, y: 399 }, POND, NOW)).toBe('svelte:0')
  })

  it('widens its slack for a fingertip', () => {
    const relay = createRelay()
    relay.record('svelte:0', outlineAt('svelte', 400, 400), NOW)
    // why: A point a cursor would miss by a whisker is exactly the miss a tap must not make — same geometry, blunter instrument.
    const wide = { x: 400, y: 400 + POND.fishLength * 0.3 }
    expect(relay.pick(wide, POND, NOW)).toBeNull()
    expect(relay.pick(wide, POND, NOW, 2.6)).toBe('svelte:0')
  })
})

describe('dead reckoning', () => {
  it('carries a stale report forward along its own course', () => {
    const relay = createRelay()
    relay.record('svelte:0', { ...outlineAt('svelte', 400, 400), speed: 200 }, NOW)
    // why: Half a second at 200 px/s slides the whole body 100 px along +x, so the pointer finds the koi where it plausibly is, not where it was.
    expect(relay.pick({ x: 460, y: 402 }, POND, NOW + 500)).toBe('svelte:0')
    expect(relay.pick({ x: 330, y: 402 }, POND, NOW + 500)).toBeNull()
  })

  it('stops reckoning at the cap rather than launching a ghost', () => {
    const relay = createRelay()
    relay.record('svelte:0', { ...outlineAt('svelte', 400, 400), speed: 200 }, NOW)
    // why: Two seconds of blind extrapolation would put the koi 400 px away; the cap holds it at the 0.6 s mark.
    expect(relay.pick({ x: 480, y: 402 }, POND, NOW + 2000)).toBe('svelte:0')
    expect(relay.pick({ x: 780, y: 402 }, POND, NOW + 2000)).toBeNull()
  })

  it('evicts a koi whose reports stopped entirely', () => {
    const relay = createRelay()
    relay.record('svelte:0', { ...outlineAt('svelte', 400, 400), speed: 200 }, NOW)
    // why: A report ten seconds old is a ghost — a session that silently died must not stay hoverable at its frozen outline, nor steer the living shoal.
    expect(relay.pick({ x: 480, y: 402 }, POND, NOW + 10_000)).toBeNull()
    relay.record('lit:0', outlineAt('lit', 460, 400), NOW + 10_000)
    expect(relay.neighborsFor('lit:0', POND, NOW + 10_000)).toEqual([])
  })

  it('reckons neighbours to the present before measuring distance', () => {
    const relay = createRelay()
    relay.record('lit:0', outlineAt('lit', 400, 400), NOW + 500)
    // why: The vue koi was far away half a second ago but has been swimming toward lit at 400 px/s since it reported.
    const closing = { ...outlineAt('vue', 400 - POND.fishLength * 3.4 - 150, 400), speed: 400 }
    expect(relay.neighborsFor('lit:0', POND, NOW).map((entry) => entry.framework)).toEqual([])
    expect(relay.neighborsFor('lit:0', POND, NOW + 500)).toEqual([])
    relay.record('vue:0', closing, NOW)
    expect(relay.neighborsFor('lit:0', POND, NOW + 500).map((entry) => entry.framework)).toEqual(['vue'])
  })

  it('leaves a fresh report exactly where it was reported', () => {
    const relay = createRelay()
    relay.record('svelte:0', { ...outlineAt('svelte', 400, 400), speed: 300 }, NOW)
    expect(relay.pick({ x: 360, y: 402 }, POND, NOW)).toBe('svelte:0')
  })
})

describe('latest', () => {
  it('returns nothing for a koi that never reported', () => {
    expect(createRelay().latest('lit:0', NOW)).toBeNull()
  })

  it('reckons the outline forward exactly as the hit-test sees it', () => {
    const relay = createRelay()
    relay.record('lit:0', { ...outlineAt('lit', 100, 100), speed: 100 }, NOW)
    expect(relay.latest('lit:0', NOW + 500)?.spine[0]?.x).toBeCloseTo(150)
  })

  it('refuses a stale report rather than handing back a ghost', () => {
    const relay = createRelay()
    relay.record('lit:0', outlineAt('lit', 100, 100), NOW)
    expect(relay.latest('lit:0', NOW + 3001)).toBeNull()
  })

  it('carries the card panel through untouched', () => {
    const relay = createRelay()
    const card = {
      frame: { x: 120, y: 60, width: 220, height: 96 },
      app: { x: 132, y: 100, width: 180, height: 14 },
      site: { x: 132, y: 130, width: 120, height: 13 },
      source: { x: 132, y: 146, width: 96, height: 13 },
    }
    relay.record('lit:0', { ...outlineAt('lit', 100, 100), card }, NOW)
    expect(relay.latest('lit:0', NOW)?.card).toEqual(card)
  })
})
