import type { PondEnvironment } from '../../model/types.js'
import { describe, expect, it } from 'vitest'
import { SHORE_ABSENT_S, createItinerary, createPaceSchedule, slipsAway, wrapAcross } from '../behaviour.js'
import { pondBounds, describePond } from '../virtual-pond.js'

/**
 * Builds a pond with a centred view for the itinerary to bias toward.
 *
 * @returns The environment.
 */
function pond(): PondEnvironment {
  return describePond(1600, 1000, 400, 300, false)
}

describe('createPaceSchedule', () => {
  it('gives the same koi the same pace at the same moment', () => {
    const first = createPaceSchedule(977)
    const second = createPaceSchedule(977)
    const samples = Array.from({ length: 400 }, (_unused, index) => index * 0.25)
    expect(samples.map((at) => first.multiplier(at))).toEqual(samples.map((at) => second.multiplier(at)))
  })

  it('rests at exactly one between events', () => {
    const pace = createPaceSchedule(1954)
    const samples = Array.from({ length: 2000 }, (_unused, index) => pace.multiplier(index * 0.1))
    expect(samples).toContain(1)
  })

  it('schedules events inside the loaf-to-burst band and nothing outside it', () => {
    const pace = createPaceSchedule(2931)
    const eventful = Array.from({ length: 4000 }, (_unused, index) => pace.multiplier(index * 0.1)).filter((value) => value !== 1)
    expect(eventful.length).toBeGreaterThan(0)
    expect(Math.min(...eventful)).toBeGreaterThanOrEqual(0.55)
    expect(Math.max(...eventful)).toBeLessThanOrEqual(2.2)
  })

  it('actually loafs and actually hurries over a long life', () => {
    const pace = createPaceSchedule(3908)
    const samples = Array.from({ length: 6000 }, (_unused, index) => pace.multiplier(index * 0.1))
    // why: A schedule that only ever produced one kind of event would read as a mode, not a life; both directions must appear.
    expect({ loafs: samples.some((value) => value < 1), hurries: samples.some((value) => value > 1) }).toEqual({
      loafs: true,
      hurries: true,
    })
  })

  it('never stacks one event onto another', () => {
    const pace = createPaceSchedule(4885)
    // how: Walking a fine grid, every change of multiplier must pass through the resting value — an event ending and the next beginning in the same instant would jump directly between two event values.
    let previous = pace.multiplier(0)
    let direct = 0
    for (let step = 1; step < 6000; step += 1) {
      const value = pace.multiplier(step * 0.05)
      if (value !== previous && value !== 1 && previous !== 1) {
        direct += 1
      }
      previous = value
    }
    expect(direct).toBe(0)
  })

  it('replays from its own zero when the clock restarts', () => {
    const pace = createPaceSchedule(5862)
    const early = pace.multiplier(3)
    pace.multiplier(500)
    expect(pace.multiplier(3)).toBe(early)
  })
})

describe('createItinerary', () => {
  it('gives the same koi the same waypoints in the same order', () => {
    const environment = pond()
    const first = createItinerary(977)
    const second = createItinerary(977)
    const away = { x: -10_000, y: -10_000 }
    const walk = (itinerary: ReturnType<typeof createItinerary>): string =>
      Array.from({ length: 5 }, (_unused, index) => {
        const { point } = itinerary.current(environment, away, index * 30)
        return `${point.x.toFixed(1)},${point.y.toFixed(1)}`
      }).join(';')
    expect(walk(first)).toBe(walk(second))
  })

  it('advances the leg when the koi arrives', () => {
    const environment = pond()
    const itinerary = createItinerary(1954)
    const first = itinerary.current(environment, { x: -10_000, y: -10_000 }, 0)
    const firstLeg = first.leg
    const arrived = itinerary.current(environment, { x: first.point.x, y: first.point.y }, 1)
    expect(arrived.leg).toBe(firstLeg + 1)
  })

  it('loses interest in a waypoint it cannot reach', () => {
    const environment = pond()
    const itinerary = createItinerary(2931)
    const first = itinerary.current(environment, { x: -10_000, y: -10_000 }, 0).leg
    const later = itinerary.current(environment, { x: -10_000, y: -10_000 }, 30).leg
    expect(later).toBe(first + 1)
  })

  it('sends roughly one leg in ten through the visible window', () => {
    // why: The window is deliberately tiny — under two percent of the pond — so an unbiased uniform draw could not reach the band's floor and removing the bias fails this spec.
    const environment = describePond(1600, 1000, 200, 150, false)
    const itinerary = createItinerary(4885)
    const away = { x: -10_000, y: -10_000 }
    let through = 0
    const legs = 400
    for (let index = 0; index < legs; index += 1) {
      const { point } = itinerary.current(environment, away, index * 30)
      const { view } = environment
      if (point.x >= view.x && point.x <= view.x + view.width && point.y >= view.y && point.y <= view.y + view.height) {
        through += 1
      }
    }
    expect(through / legs).toBeGreaterThan(0.05)
    expect(through / legs).toBeLessThan(0.2)
  })

  it('still visits the outskirts', () => {
    const environment = pond()
    const itinerary = createItinerary(5862)
    const away = { x: -10_000, y: -10_000 }
    const shorter = Math.min(environment.width, environment.height)
    let outskirts = 0
    for (let index = 0; index < 200; index += 1) {
      const { point } = itinerary.current(environment, away, index * 30)
      const fromCentre = Math.hypot(point.x - environment.width / 2, point.y - environment.height / 2)
      if (fromCentre > shorter * 0.35) {
        outskirts += 1
      }
    }
    expect(outskirts).toBeGreaterThan(20)
  })

  it('abandons the current waypoint on request', () => {
    const environment = pond()
    const itinerary = createItinerary(6839)
    const first = itinerary.current(environment, { x: -10_000, y: -10_000 }, 5).leg
    itinerary.abandon()
    expect(itinerary.current(environment, { x: -10_000, y: -10_000 }, 5.1).leg).toBe(first + 1)
  })
})

describe('slipsAway', () => {
  it('decides the same approach the same way every time', () => {
    expect(slipsAway(977, 4)).toBe(slipsAway(977, 4))
  })

  it('lets roughly one approach in five slip out', () => {
    let slipped = 0
    const rolls = 1000
    for (let seed = 977; seed <= 6839; seed += 977) {
      for (let crossing = 0; crossing < Math.floor(rolls / 7); crossing += 1) {
        if (slipsAway(seed, crossing)) {
          slipped += 1
        }
      }
    }
    const rate = slipped / (Math.floor(rolls / 7) * 7)
    expect(rate).toBeGreaterThan(0.12)
    expect(rate).toBeLessThan(0.28)
  })
})

describe('wrapAcross', () => {
  it('carries a koi that left on the right back in from the left', () => {
    const environment = pond()
    const bounds = pondBounds(environment)
    const wrapped = wrapAcross(environment, { x: bounds.right + 40, y: 300 })
    expect(wrapped).toEqual({ x: bounds.left + 40, y: 300 })
  })

  it('carries a koi that left past the top back in from the bottom', () => {
    const environment = pond()
    const bounds = pondBounds(environment)
    const wrapped = wrapAcross(environment, { x: 500, y: bounds.top - 25 })
    expect(wrapped).toEqual({ x: 500, y: bounds.bottom - 25 })
  })

  it('leaves a position inside pond space untouched', () => {
    const environment = pond()
    expect(wrapAcross(environment, { x: 500, y: 300 })).toEqual({ x: 500, y: 300 })
  })

  it('keeps the absence long enough to read as a real departure', () => {
    expect(SHORE_ABSENT_S).toBeGreaterThanOrEqual(4)
  })
})
