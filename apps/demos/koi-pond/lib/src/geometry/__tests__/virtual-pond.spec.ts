import { describe, expect, it } from 'vitest'
import {
  MARGIN_FISH_LENGTHS,
  boundaryPressure,
  describePond,
  entryStation,
  isVisible,
  nominalFishLength,
  pondBounds,
  pondCentre,
  pondPoint,
  pondWindow,
} from '../virtual-pond.js'
import { KOI_FRAMEWORKS } from '../../model/types.js'
import { koiSeed } from '../../model/traits.js'

/** A pond derived from a typical desktop screen, viewed through a same-sized frame. */
function desktopPond() {
  return describePond(1440, 900, 1440, 900, false)
}

/** The same desktop pond viewed through a small card-sized frame. */
function cardViewPond() {
  return describePond(1440, 900, 480, 360, false)
}

describe('nominalFishLength', () => {
  it('scales with the shorter pond axis', () => {
    expect(nominalFishLength(1000, 600)).toBeCloseTo(216)
  })

  it('never shrinks below the legible floor', () => {
    expect(nominalFishLength(320, 180)).toBe(130)
  })

  it('never grows past the ceiling on a cinema display', () => {
    expect(nominalFishLength(5120, 2880)).toBe(560)
  })
})

describe('describePond', () => {
  it('sizes the pond from the screen, not the presenting frame', () => {
    const pond = cardViewPond()
    expect({ width: pond.width, height: pond.height }).toEqual({ width: 1440, height: 900 })
  })

  it('windows the frame onto the centre of the pond', () => {
    const pond = cardViewPond()
    expect(pond.view).toEqual({ x: (1440 - 480) / 2, y: (900 - 360) / 2, width: 480, height: 360 })
  })

  it('clamps a degenerate screen up to the smallest honest pond', () => {
    const pond = describePond(0, 0, 320, 240, false)
    expect({ width: pond.width, height: pond.height }).toEqual({ width: 800, height: 600 })
  })

  it('clamps a video wall down to a swimmable pond', () => {
    const pond = describePond(7680, 4320, 1920, 1080, false)
    expect({ width: pond.width, height: pond.height }).toEqual({ width: 3840, height: 2400 })
  })

  it('reports margins measured in fish lengths', () => {
    const pond = desktopPond()
    expect(pond.margin).toBeCloseTo(pond.fishLength * MARGIN_FISH_LENGTHS)
  })

  it('carries the reduced-motion posture through to every fish', () => {
    expect(describePond(800, 600, 800, 600, true).reducedMotion).toBe(true)
  })

  it('offers seven depth levels', () => {
    expect(desktopPond().depthLevels).toBe(7)
  })
})

describe('pondWindow', () => {
  it('centres the window on the pond', () => {
    expect(pondWindow({ width: 1440, height: 900 }, 480, 360)).toEqual({ x: 480, y: 270, width: 480, height: 360 })
  })

  it('lets a frame larger than the pond window past its edges', () => {
    const view = pondWindow({ width: 800, height: 600 }, 1000, 700)
    expect({ x: view.x, y: view.y }).toEqual({ x: -100, y: -50 })
  })
})

describe('pondBounds', () => {
  it('extends past every pond edge by the margin', () => {
    const pond = describePond(800, 600, 800, 600, false)
    expect(pondBounds(pond)).toEqual({ left: -pond.margin, top: -pond.margin, right: 800 + pond.margin, bottom: 600 + pond.margin })
  })
})

describe('isVisible', () => {
  it('accepts a point inside the visible window', () => {
    const pond = cardViewPond()
    expect(isVisible(pond, pondCentre(pond))).toBe(true)
  })

  it('rejects a point in the pond but outside the window', () => {
    const pond = cardViewPond()
    expect(isVisible(pond, { x: 100, y: 100 })).toBe(false)
  })

  it('accepts an out-of-window point once slack covers it', () => {
    const pond = cardViewPond()
    expect(isVisible(pond, { x: pond.view.x - 40, y: pond.view.y + 40 }, 60)).toBe(true)
  })

  it('rejects a point past the window bottom', () => {
    const pond = desktopPond()
    expect(isVisible(pond, { x: 400, y: 1200 })).toBe(false)
  })
})

describe('pondPoint', () => {
  it('places the half fractions at the centre of the visible window', () => {
    const pond = cardViewPond()
    expect(pondPoint(pond, 0.5, 0.5)).toEqual({ x: 720, y: 450 })
  })

  it('places the origin fraction at the window corner, not the pond corner', () => {
    const pond = cardViewPond()
    expect(pondPoint(pond, 0, 0)).toEqual({ x: pond.view.x, y: pond.view.y })
  })
})

describe('boundaryPressure', () => {
  it('is silent for a koi mid-pond', () => {
    const pond = desktopPond()
    expect(boundaryPressure(pond, { x: 720, y: 450 }, 0).urgency).toBe(0)
  })

  it('is silent for a koi running parallel to the edge it is near', () => {
    const pond = desktopPond()
    const bounds = pondBounds(pond)
    expect(boundaryPressure(pond, { x: bounds.left + 10, y: 450 }, Math.PI / 2).urgency).toBe(0)
  })

  it('builds as a koi closes on the edge it is pointed at', () => {
    const pond = desktopPond()
    const bounds = pondBounds(pond)
    const far = boundaryPressure(pond, { x: bounds.left + pond.fishLength * 2, y: 450 }, Math.PI)
    const near = boundaryPressure(pond, { x: bounds.left + pond.fishLength * 0.3, y: 450 }, Math.PI)
    expect(near.urgency).toBeGreaterThan(far.urgency)
  })

  it('points a koi at the left edge back toward open water', () => {
    const pond = desktopPond()
    const bounds = pondBounds(pond)
    const pressure = boundaryPressure(pond, { x: bounds.left + 5, y: 450 }, Math.PI)
    expect({ x: Math.round(pressure.inward.x), y: Math.round(pressure.inward.y) }).toEqual({ x: 1, y: 0 })
  })

  it('pushes a koi out of a corner along both axes at once', () => {
    const pond = desktopPond()
    const bounds = pondBounds(pond)
    const pressure = boundaryPressure(pond, { x: bounds.left + 5, y: bounds.top + 5 }, Math.PI * 1.25)
    expect(pressure.inward.x > 0 && pressure.inward.y > 0).toBe(true)
  })

  it('never reports more than full urgency', () => {
    const pond = desktopPond()
    const bounds = pondBounds(pond)
    expect(boundaryPressure(pond, { x: bounds.left - 400, y: bounds.top - 400 }, Math.PI * 1.25).urgency).toBeLessThanOrEqual(1)
  })
})

describe('entryStation', () => {
  it('opens every pair of koi at least a fish length apart', () => {
    for (const [width, height] of [
      [800, 600],
      [1440, 900],
      [1920, 1080],
      [3840, 2400],
    ]) {
      const pond = describePond(width ?? 0, height ?? 0, width ?? 0, height ?? 0, false)
      const entries = KOI_FRAMEWORKS.map((framework) => entryStation(pond, koiSeed(framework)).position)
      for (let a = 0; a < entries.length; a += 1) {
        for (let b = a + 1; b < entries.length; b += 1) {
          const gap = Math.hypot((entries[a]?.x ?? 0) - (entries[b]?.x ?? 0), (entries[a]?.y ?? 0) - (entries[b]?.y ?? 0))
          expect(gap).toBeGreaterThanOrEqual(pond.fishLength)
        }
      }
    }
  })

  it('opens every koi inside the pond proper, never out in the margin', () => {
    const pond = desktopPond()
    for (const framework of KOI_FRAMEWORKS) {
      const { position } = entryStation(pond, koiSeed(framework))
      expect(position.x).toBeGreaterThan(0)
      expect(position.x).toBeLessThan(pond.width)
      expect(position.y).toBeGreaterThan(0)
      expect(position.y).toBeLessThan(pond.height)
    }
  })

  it('does not point the shoal at the centre of the pond', () => {
    const pond = desktopPond()
    const centre = pondCentre(pond)
    const centreward = KOI_FRAMEWORKS.filter((framework) => {
      const entry = entryStation(pond, koiSeed(framework))
      const toCentre = Math.atan2(centre.y - entry.position.y, centre.x - entry.position.x)
      const offset = Math.abs(((entry.heading - toCentre + Math.PI * 3) % (Math.PI * 2)) - Math.PI)
      return offset < 0.35
    })
    expect(centreward).toEqual([])
  })

  it('does not lay the shoal out on a circle', () => {
    const pond = desktopPond()
    const centre = pondCentre(pond)
    const radii = KOI_FRAMEWORKS.map((framework) => {
      const entry = entryStation(pond, koiSeed(framework))
      return Math.hypot(entry.position.x - centre.x, entry.position.y - centre.y)
    })
    const spread = Math.max(...radii) - Math.min(...radii)
    // why: A perfect circle has zero radial spread; demanding at least half a fish length of it catches any regression to the ring.
    expect(spread).toBeGreaterThan(pond.fishLength * 0.5)
  })

  it('gives the same koi the same station on every reload', () => {
    const pond = desktopPond()
    expect(entryStation(pond, koiSeed('vue'))).toEqual(entryStation(pond, koiSeed('vue')))
  })

  it('places a koi with an unknown seed without touching the shoal relaxation', () => {
    const pond = desktopPond()
    const entry = entryStation(pond, 12345)
    expect(Number.isFinite(entry.position.x) && Number.isFinite(entry.heading)).toBe(true)
  })
})
