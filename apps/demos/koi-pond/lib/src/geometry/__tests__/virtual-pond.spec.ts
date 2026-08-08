import { describe, expect, it } from 'vitest'
import {
  MARGIN_FISH_LENGTHS,
  boundaryPressure,
  describePond,
  entryStation,
  isVisible,
  nominalFishLength,
  pondBounds,
  pondPoint,
  rescalePoint,
} from '../virtual-pond.js'
import { KOI_FRAMEWORKS } from '../../model/types.js'
import { koiSeed } from '../../model/traits.js'

/** A pond the size of a typical desktop viewport. */
function desktopPond() {
  return describePond(1440, 900, false)
}

describe('nominalFishLength', () => {
  it('scales with the shorter viewport axis', () => {
    expect(nominalFishLength(1000, 600)).toBeCloseTo(120)
  })

  it('never shrinks below the legible floor in a small card', () => {
    expect(nominalFishLength(320, 180)).toBe(90)
  })

  it('never grows past the ceiling on a wide desktop', () => {
    expect(nominalFishLength(3840, 2160)).toBe(260)
  })

  it('treats a frame that has not been laid out as the smallest pond', () => {
    expect(nominalFishLength(0, 0)).toBe(90)
  })
})

describe('describePond', () => {
  it('reports margins measured in fish lengths', () => {
    const pond = desktopPond()
    expect(pond.margin).toBeCloseTo(pond.fishLength * MARGIN_FISH_LENGTHS)
  })

  it('carries the reduced-motion posture through to every fish', () => {
    expect(describePond(800, 600, true).reducedMotion).toBe(true)
  })

  it('offers seven depth levels', () => {
    expect(desktopPond().depthLevels).toBe(7)
  })
})

describe('pondBounds', () => {
  it('extends past every viewport edge by the margin', () => {
    const pond = describePond(800, 600, false)
    expect(pondBounds(pond)).toEqual({ left: -pond.margin, top: -pond.margin, right: 800 + pond.margin, bottom: 600 + pond.margin })
  })
})

describe('isVisible', () => {
  it('accepts a point inside the viewport', () => {
    expect(isVisible(desktopPond(), { x: 400, y: 300 })).toBe(true)
  })

  it('rejects a point out in the margin', () => {
    expect(isVisible(desktopPond(), { x: -40, y: 300 })).toBe(false)
  })

  it('accepts a point in the margin once slack covers it', () => {
    expect(isVisible(desktopPond(), { x: -40, y: 300 }, 60)).toBe(true)
  })

  it('rejects a point past the bottom edge', () => {
    expect(isVisible(desktopPond(), { x: 400, y: 1200 })).toBe(false)
  })
})

describe('pondPoint', () => {
  it('places the centre of the pond at the centre of the viewport', () => {
    const pond = describePond(800, 600, false)
    expect(pondPoint(pond, 0.5, 0.5)).toEqual({ x: 400, y: 300 })
  })

  it('places the origin fraction at the far corner of the margin', () => {
    const pond = describePond(800, 600, false)
    expect(pondPoint(pond, 0, 0)).toEqual({ x: -pond.margin, y: -pond.margin })
  })
})

describe('rescalePoint', () => {
  it('keeps a koi at the same relative station when the pond resizes', () => {
    const from = describePond(800, 600, false)
    const to = describePond(1600, 1200, false)
    const centre = rescalePoint(pondPoint(from, 0.75, 0.25), from, to)
    expect({ x: Math.round(centre.x), y: Math.round(centre.y) }).toEqual({
      x: Math.round(pondPoint(to, 0.75, 0.25).x),
      y: Math.round(pondPoint(to, 0.75, 0.25).y),
    })
  })

  it('parks a koi mid-pond when the old frame had never been laid out', () => {
    const from = describePond(0, 0, false)
    const to = describePond(800, 600, false)
    expect(rescalePoint({ x: 0, y: 0 }, from, to)).toEqual(pondPoint(to, 0.5, 0.5))
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
  it('enters the pond pointed at the middle of it', () => {
    const pond = desktopPond()
    const entry = entryStation(pond, koiSeed('lit'))
    const toCentre = Math.atan2(pond.height / 2 - entry.position.y, pond.width / 2 - entry.position.x)
    expect(entry.heading).toBeCloseTo(toCentre)
  })

  it('brings every koi in from its own quarter of the pond', () => {
    const pond = desktopPond()
    const stations = KOI_FRAMEWORKS.map((framework) => JSON.stringify(entryStation(pond, koiSeed(framework)).position))
    expect(new Set(stations).size).toBe(KOI_FRAMEWORKS.length)
  })

  it('opens the scene with every koi already in view', () => {
    const pond = desktopPond()
    expect(KOI_FRAMEWORKS.every((framework) => isVisible(pond, entryStation(pond, koiSeed(framework)).position))).toBe(true)
  })

  it('fans the shoal out rather than clustering it on one arc', () => {
    const pond = desktopPond()
    const angles = KOI_FRAMEWORKS.map((framework) => {
      const entry = entryStation(pond, koiSeed(framework))
      return Math.atan2(entry.position.y - pond.height / 2, entry.position.x - pond.width / 2)
    }).sort((a, b) => a - b)
    const gaps = angles.slice(1).map((angle, index) => angle - (angles[index] ?? 0))
    // why: Seven koi evenly spaced would sit 51 degrees apart; asserting every gap clears 30 catches any collapse onto one point.
    expect(gaps.every((gap) => gap > (30 * Math.PI) / 180)).toBe(true)
  })

  it('gives the same koi the same station on every reload', () => {
    const pond = desktopPond()
    expect(entryStation(pond, koiSeed('vue'))).toEqual(entryStation(pond, koiSeed('vue')))
  })

  it('does not lay the shoal out on a perfect circle', () => {
    const pond = desktopPond()
    const radii = KOI_FRAMEWORKS.map((framework) => {
      const entry = entryStation(pond, koiSeed(framework))
      return Math.round(Math.hypot(entry.position.x - pond.width / 2, entry.position.y - pond.height / 2))
    })
    expect(new Set(radii).size).toBeGreaterThan(1)
  })
})
