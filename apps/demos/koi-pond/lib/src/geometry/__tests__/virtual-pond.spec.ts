import { describe, expect, it } from 'vitest'
import {
  ENTRY_SEPARATION_FISH_LENGTHS,
  MARGIN_FISH_LENGTHS,
  boundaryPressure,
  describePond,
  describePondForFrame,
  entryStation,
  isVisible,
  koiFrameBox,
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

describe('describePondForFrame', () => {
  it('takes a card-sized frame as the whole world', () => {
    const pond = describePondForFrame(288, 288, false)
    expect({ width: pond.width, height: pond.height }).toEqual({ width: 288, height: 288 })
  })

  it('floors the koi at the legible length rather than flooring the world', () => {
    expect(describePondForFrame(288, 288, false).fishLength).toBe(130)
  })

  it('fills its own view edge to edge', () => {
    expect(describePondForFrame(288, 288, false).view).toEqual({ x: 0, y: 0, width: 288, height: 288 })
  })

  it('reports margins measured in fish lengths', () => {
    const pond = describePondForFrame(288, 288, false)
    expect(pond.margin).toBeCloseTo(pond.fishLength * MARGIN_FISH_LENGTHS)
  })

  it('agrees with describePond wherever the world floor is not in play', () => {
    for (const [width, height] of [
      [800, 600],
      [1440, 900],
      [1920, 1080],
      [3840, 2400],
      [7680, 4320],
    ]) {
      expect(describePondForFrame(width ?? 0, height ?? 0, false)).toEqual(
        describePond(width ?? 0, height ?? 0, width ?? 0, height ?? 0, false)
      )
    }
  })

  it('still clamps a video wall down to a swimmable pond', () => {
    const pond = describePondForFrame(7680, 4320, false)
    expect({ width: pond.width, height: pond.height }).toEqual({ width: 3840, height: 2400 })
  })

  it('carries the reduced-motion posture through to every fish', () => {
    expect(describePondForFrame(288, 288, true).reducedMotion).toBe(true)
  })

  it('falls back to the smallest honest pond for a frame measured before layout', () => {
    expect(describePondForFrame(0, 0, false)).toEqual(describePond(0, 0, 0, 0, false))
  })

  it('treats a negative or unmeasurable frame axis as degenerate', () => {
    const pond = describePondForFrame(-100, Number.NaN, false)
    expect({ width: pond.width, height: pond.height }).toEqual({ width: 800, height: 600 })
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

  it('holds every canonical station exactly where it has always been', () => {
    // why: The ordinal-0 equality spec compares two calls through the same code, so only pinned values catch the whole canonical derivation drifting together.
    const golden = [
      {
        pond: describePond(800, 600, 800, 600, false),
        framework: 'vanilla',
        x: 245.0968419680296,
        y: 71.56836551886599,
        heading: -0.9796259705432153,
      },
      {
        pond: describePond(1440, 900, 1440, 900, false),
        framework: 'vue',
        x: 972.1574482015257,
        y: 638.7358591719624,
        heading: 2.809546692158815,
      },
      {
        pond: describePond(1440, 900, 1440, 900, false),
        framework: 'angular',
        x: 640.9329748648748,
        y: 474.9236177477412,
        heading: -2.369508242213704,
      },
    ] as const
    for (const { pond, framework, x, y, heading } of golden) {
      const entry = entryStation(pond, koiSeed(framework))
      expect(entry.position.x).toBeCloseTo(x, 8)
      expect(entry.position.y).toBeCloseTo(y, 8)
      expect(entry.heading).toBeCloseTo(heading, 8)
    }
  })

  it('places a koi with an unknown seed without touching the shoal relaxation', () => {
    const pond = desktopPond()
    const entry = entryStation(pond, 12345)
    expect(Number.isFinite(entry.position.x) && Number.isFinite(entry.heading)).toBe(true)
  })

  it('gives ordinal 0 exactly the station the two-argument call derives', () => {
    const pond = desktopPond()
    for (const framework of KOI_FRAMEWORKS) {
      expect(entryStation(pond, koiSeed(framework), 0)).toEqual(entryStation(pond, koiSeed(framework)))
    }
  })

  it('opens every twin of one framework at least the separation target from its siblings', () => {
    for (const pond of [
      describePond(800, 600, 800, 600, false),
      describePond(1440, 900, 1440, 900, false),
      describePond(1920, 1080, 1920, 1080, false),
      describePond(3840, 2400, 3840, 2400, false),
      describePondForFrame(288, 288, false),
    ]) {
      // why: A settling push can land a twin exactly on the separation rim, so the assertion concedes float rounding and nothing more.
      const separation = pond.fishLength * ENTRY_SEPARATION_FISH_LENGTHS - 1e-6
      for (const framework of KOI_FRAMEWORKS) {
        const stations = [0, 1, 2, 3, 4].map((instance) => entryStation(pond, koiSeed(framework), instance).position)
        for (let a = 0; a < stations.length; a += 1) {
          for (let b = a + 1; b < stations.length; b += 1) {
            const gap = Math.hypot((stations[a]?.x ?? 0) - (stations[b]?.x ?? 0), (stations[a]?.y ?? 0) - (stations[b]?.y ?? 0))
            expect(gap).toBeGreaterThanOrEqual(separation)
          }
        }
      }
    }
  })

  it('opens first and second twins inside the pond proper, never out in the margin', () => {
    const pond = desktopPond()
    for (const framework of KOI_FRAMEWORKS) {
      for (const instance of [1, 2]) {
        const { position } = entryStation(pond, koiSeed(framework), instance)
        expect(position.x).toBeGreaterThan(0)
        expect(position.x).toBeLessThan(pond.width)
        expect(position.y).toBeGreaterThan(0)
        expect(position.y).toBeLessThan(pond.height)
      }
    }
  })

  it('keeps every twin of even a saturated pond at an honest pond-space position', () => {
    const pond = desktopPond()
    const bounds = pondBounds(pond)
    for (const framework of KOI_FRAMEWORKS) {
      for (const instance of [1, 2, 3, 4]) {
        const { position } = entryStation(pond, koiSeed(framework), instance)
        expect(position.x).toBeGreaterThanOrEqual(bounds.left)
        expect(position.x).toBeLessThanOrEqual(bounds.right)
        expect(position.y).toBeGreaterThanOrEqual(bounds.top)
        expect(position.y).toBeLessThanOrEqual(bounds.bottom)
      }
    }
  })

  it('gives the same twin the same station on every reload', () => {
    const pond = desktopPond()
    expect(entryStation(pond, koiSeed('vue'), 3)).toEqual(entryStation(pond, koiSeed('vue'), 3))
  })

  it('never opens two koi of a crowded pond on the same spot, whatever their frameworks', () => {
    for (const pond of [
      describePond(800, 600, 800, 600, false),
      describePond(1440, 900, 1440, 900, false),
      describePond(1920, 1080, 1920, 1080, false),
      describePond(3840, 2400, 3840, 2400, false),
      describePondForFrame(288, 288, false),
    ]) {
      const stations = KOI_FRAMEWORKS.flatMap((framework) =>
        [0, 1, 2, 3, 4].map((instance) => entryStation(pond, koiSeed(framework), instance).position)
      )
      for (let a = 0; a < stations.length; a += 1) {
        for (let b = a + 1; b < stations.length; b += 1) {
          const gap = Math.hypot((stations[a]?.x ?? 0) - (stations[b]?.x ?? 0), (stations[a]?.y ?? 0) - (stations[b]?.y ?? 0))
          // why: Twins of different frameworks cannot be told about each other, so a saturated pond only promises visibly distinct spots; identical stations are the failure this guards, not mere closeness.
          expect(gap).toBeGreaterThan(pond.fishLength * 0.05)
        }
      }
    }
  })

  it('separates the twins of a koi with an unknown seed from each other', () => {
    const pond = desktopPond()
    const canonical = entryStation(pond, 12345)
    const twin = entryStation(pond, 12345, 1)
    expect(twin.position).not.toEqual(canonical.position)
    expect(Number.isFinite(twin.position.x) && Number.isFinite(twin.heading)).toBe(true)
  })
})

describe('koiFrameBox', () => {
  it('centres the box on the body, not the nose', () => {
    const pond = desktopPond()
    // how: Heading along +x, the body trails to the left of the nose, so the box centre sits half a length back.
    const box = koiFrameBox({ x: 700, y: 450 }, 0, 200, pond.view)
    expect(box.x + box.size / 2).toBeCloseTo(600)
    expect(box.y + box.size / 2).toBeCloseTo(450)
  })

  it('claims enough water around the body for fins, sweep, and shadow', () => {
    const pond = desktopPond()
    const box = koiFrameBox({ x: 700, y: 450 }, 0, 200, pond.view)
    expect(box.size).toBeGreaterThanOrEqual(200 * 1.5)
  })

  it('sees a koi in the middle of the window', () => {
    const pond = desktopPond()
    expect(koiFrameBox({ x: 700, y: 450 }, 0, 200, pond.view).visible).toBe(true)
  })

  it('culls a koi far outside the window', () => {
    const pond = describePond(1440, 900, 400, 300, false)
    expect(koiFrameBox({ x: -600, y: -600 }, 0, 200, pond.view).visible).toBe(false)
  })

  it('keeps a koi whose box merely clips a corner', () => {
    const pond = describePond(1440, 900, 400, 300, false)
    const view = pond.view
    const box = koiFrameBox({ x: view.x - 60, y: view.y - 60 }, Math.PI / 4, 200, view)
    expect(box.visible).toBe(true)
  })

  it('reuses the caller-supplied box without allocating', () => {
    const pond = desktopPond()
    const scratch = { x: 0, y: 0, size: 0, visible: false }
    expect(koiFrameBox({ x: 700, y: 450 }, 0, 200, pond.view, scratch)).toBe(scratch)
  })
})
