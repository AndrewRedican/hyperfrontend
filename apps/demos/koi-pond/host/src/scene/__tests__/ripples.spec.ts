import { describe, expect, it } from 'vitest'
import {
  MAX_RIPPLES,
  RIPPLE_LIFETIME_S,
  RIPPLE_MIN_GAP_MS,
  acceptsRipple,
  addRipple,
  advanceRipples,
  createRippleField,
  resolveRipple,
} from '../ripples'

/** The pond's nominal fish length in every fixture here. */
const FISH_LENGTH = 120

/** A strike at the middle of a small pond. */
const ORIGIN = { x: 400, y: 300 }

describe('createRippleField', () => {
  it('starts with still water', () => {
    expect(createRippleField().ripples).toEqual([])
  })
})

describe('acceptsRipple', () => {
  it('lets a source that has never broken the surface do so', () => {
    expect(acceptsRipple(createRippleField(), 'lit', 1000)).toBe(true)
  })

  it('refuses a source that just broke it', () => {
    const field = addRipple(createRippleField(), 'lit', ORIGIN, 1, 1000)
    expect(acceptsRipple(field, 'lit', 1000 + RIPPLE_MIN_GAP_MS - 1)).toBe(false)
  })

  it('lets the same source through once the gap is spent', () => {
    const field = addRipple(createRippleField(), 'lit', ORIGIN, 1, 1000)
    expect(acceptsRipple(field, 'lit', 1000 + RIPPLE_MIN_GAP_MS)).toBe(true)
  })

  it('rate-limits each source on its own clock', () => {
    const field = addRipple(createRippleField(), 'lit', ORIGIN, 1, 1000)
    expect(acceptsRipple(field, 'vue', 1000)).toBe(true)
  })
})

describe('addRipple', () => {
  it('puts a new ring on the water', () => {
    expect(addRipple(createRippleField(), 'pointer', ORIGIN, 1, 0).ripples).toHaveLength(1)
  })

  it('starts the ring at no age', () => {
    expect(addRipple(createRippleField(), 'pointer', ORIGIN, 1, 0).ripples[0]?.ageS).toBe(0)
  })

  it('clamps a strike harder than the water can be struck', () => {
    expect(addRipple(createRippleField(), 'pointer', ORIGIN, 4, 0).ripples[0]?.strength).toBe(1)
  })

  it('clamps a negative strike to no strike at all', () => {
    expect(addRipple(createRippleField(), 'pointer', ORIGIN, -2, 0).ripples[0]?.strength).toBe(0)
  })

  it('never tracks more rings than the surface budget allows', () => {
    let field = createRippleField()
    for (let index = 0; index < MAX_RIPPLES * 2; index += 1) {
      field = addRipple(field, `source-${index}`, ORIGIN, 1, index)
    }
    expect(field.ripples).toHaveLength(MAX_RIPPLES)
  })

  it('drops the oldest ring rather than refusing the newest', () => {
    let field = createRippleField()
    for (let index = 0; index <= MAX_RIPPLES; index += 1) {
      field = addRipple(field, `source-${index}`, { x: index, y: 0 }, 1, index)
    }
    expect(field.ripples.at(-1)?.origin.x).toBe(MAX_RIPPLES)
  })
})

describe('advanceRipples', () => {
  it('ages a ring as time passes', () => {
    const field = advanceRipples(addRipple(createRippleField(), 'pointer', ORIGIN, 1, 0), 0.5)
    expect(field.ripples[0]?.ageS).toBeCloseTo(0.5)
  })

  it('retires a ring once it has finished spreading', () => {
    const field = advanceRipples(addRipple(createRippleField(), 'pointer', ORIGIN, 1, 0), RIPPLE_LIFETIME_S)
    expect(field.ripples).toEqual([])
  })

  it('keeps the rate-limit record after the ring itself is gone', () => {
    const field = advanceRipples(addRipple(createRippleField(), 'lit', ORIGIN, 1, 500), RIPPLE_LIFETIME_S)
    expect(acceptsRipple(field, 'lit', 500 + RIPPLE_MIN_GAP_MS - 1)).toBe(false)
  })

  it('leaves still water still', () => {
    expect(advanceRipples(createRippleField(), 1).ripples).toEqual([])
  })
})

describe('resolveRipple', () => {
  it('starts a ring at no radius', () => {
    expect(resolveRipple({ origin: ORIGIN, ageS: 0, strength: 1 }, FISH_LENGTH).radius).toBe(0)
  })

  it('spreads the ring as it ages', () => {
    const early = resolveRipple({ origin: ORIGIN, ageS: 0.4, strength: 1 }, FISH_LENGTH)
    const late = resolveRipple({ origin: ORIGIN, ageS: 1.6, strength: 1 }, FISH_LENGTH)
    expect(late.radius).toBeGreaterThan(early.radius)
  })

  it('slows the spread as the ring runs out of energy', () => {
    const first = resolveRipple({ origin: ORIGIN, ageS: 0.4, strength: 1 }, FISH_LENGTH).radius
    const second = resolveRipple({ origin: ORIGIN, ageS: 0.8, strength: 1 }, FISH_LENGTH).radius
    const third = resolveRipple({ origin: ORIGIN, ageS: 1.2, strength: 1 }, FISH_LENGTH).radius
    expect(third - second).toBeLessThan(second - first)
  })

  it('fades the ring out over its life', () => {
    const early = resolveRipple({ origin: ORIGIN, ageS: 0.2, strength: 1 }, FISH_LENGTH)
    const late = resolveRipple({ origin: ORIGIN, ageS: 2.2, strength: 1 }, FISH_LENGTH)
    expect(late.alpha).toBeLessThan(early.alpha)
  })

  it('leaves nothing behind once the ring has finished', () => {
    expect(resolveRipple({ origin: ORIGIN, ageS: RIPPLE_LIFETIME_S, strength: 1 }, FISH_LENGTH).alpha).toBe(0)
  })

  it('spreads a harder strike further than a gentle one', () => {
    const hard = resolveRipple({ origin: ORIGIN, ageS: 1, strength: 1 }, FISH_LENGTH).radius
    const soft = resolveRipple({ origin: ORIGIN, ageS: 1, strength: 0.2 }, FISH_LENGTH).radius
    expect(hard).toBeGreaterThan(soft)
  })

  it('scales the reach with the pond rather than the pixel', () => {
    const small = resolveRipple({ origin: ORIGIN, ageS: 1, strength: 1 }, 60).radius
    const large = resolveRipple({ origin: ORIGIN, ageS: 1, strength: 1 }, 180).radius
    expect(large).toBeCloseTo(small * 3)
  })
})
