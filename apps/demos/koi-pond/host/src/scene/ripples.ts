/**
 * Surface ripple state.
 *
 * The pond's surface is the host's alone — no koi ever paints on it. What a koi
 * can do is *ask*, and only from the level immediately under the surface; the
 * host is what decides whether the water actually breaks, and how often.
 *
 * This module is the arithmetic of that: rings age, spread, and fade, and a
 * rate limit keeps an over-eager fish from boiling the pond. The painting lives
 * next door in `surface-canvas.ts`.
 */
import type { Vec2 } from '@hyperfrontend/demo-koi-lib'

/** How long one ring takes to spread and vanish, in seconds. */
export const RIPPLE_LIFETIME_S = 2.8

/** How far a full-strength ring spreads, as a multiple of the pond's nominal fish length. */
export const RIPPLE_REACH = 1.9

/** Shortest gap between two ripples honoured for one koi, in milliseconds. */
export const RIPPLE_MIN_GAP_MS = 900

/** Most rings the surface will track at once, so a burst cannot unbound the paint cost. */
export const MAX_RIPPLES = 24

/** One expanding ring on the surface. */
export interface Ripple {
  /** Where the water broke, in pond space. */
  origin: Vec2
  /** Seconds this ring has been spreading. */
  ageS: number
  /** How hard the water was struck, 0 to 1. */
  strength: number
}

/** The surface's live rings. */
export interface RippleField {
  /** Every ring currently spreading, oldest first. */
  ripples: readonly Ripple[]
  /** When each source last broke the surface, by source key. */
  lastAt: ReadonlyMap<string, number>
}

/**
 * Starts an empty surface.
 *
 * @returns A field with no rings.
 */
export function createRippleField(): RippleField {
  return { ripples: [], lastAt: new Map() }
}

/**
 * Whether a source may break the surface right now.
 *
 * @param field - The surface's current state.
 * @param source - Who is asking; the host's own clicks use their own key.
 * @param now - Host clock reading in milliseconds.
 * @returns `true` when the request should be honoured.
 *
 * @example Gating a koi's request
 * ```typescript
 * if (acceptsRipple(field, framework, Date.now())) {
 *   field = addRipple(field, framework, origin, strength, Date.now())
 * }
 * ```
 */
export function acceptsRipple(field: RippleField, source: string, now: number): boolean {
  const last = field.lastAt.get(source)
  return last === undefined || now - last >= RIPPLE_MIN_GAP_MS
}

/**
 * Breaks the surface at a point.
 *
 * @param field - The surface's current state.
 * @param source - Who broke it.
 * @param origin - Where, in pond space.
 * @param strength - How hard, 0 to 1.
 * @param now - Host clock reading in milliseconds.
 * @returns The field with the new ring added.
 */
export function addRipple(field: RippleField, source: string, origin: Vec2, strength: number, now: number): RippleField {
  const clamped = strength < 0 ? 0 : strength > 1 ? 1 : strength
  const lastAt = new Map(field.lastAt)
  lastAt.set(source, now)
  // why: Dropping the oldest ring rather than refusing the newest keeps a click responsive even on a busy surface.
  const kept = field.ripples.length >= MAX_RIPPLES ? field.ripples.slice(field.ripples.length - MAX_RIPPLES + 1) : field.ripples
  return { ripples: [...kept, { origin, ageS: 0, strength: clamped }], lastAt }
}

/**
 * Ages every ring, retiring the ones that have finished spreading.
 *
 * @param field - The surface's current state.
 * @param dt - Seconds since the previous frame.
 * @returns The aged field.
 */
export function advanceRipples(field: RippleField, dt: number): RippleField {
  const ripples: Ripple[] = []
  for (const ripple of field.ripples) {
    const ageS = ripple.ageS + dt
    if (ageS < RIPPLE_LIFETIME_S) {
      ripples.push({ origin: ripple.origin, ageS, strength: ripple.strength })
    }
  }
  return { ripples, lastAt: field.lastAt }
}

/** A ring resolved into something paintable. */
export interface RippleFrame {
  /** Where the ring is centred, in pond space. */
  origin: Vec2
  /** Its current radius in CSS pixels. */
  radius: number
  /** How strongly to draw it, 0 to 1. */
  alpha: number
}

/**
 * Resolves a ring into the radius and alpha the painter draws it at.
 *
 * The radius eases out — the water leaps away from the strike and then slows —
 * while the alpha fades on a curve that keeps the ring visible through most of
 * its spread and then lets it go quickly.
 *
 * @param ripple - The ring to resolve.
 * @param fishLength - The pond's nominal fish length, which sets the ring's reach.
 * @returns The paintable frame.
 */
export function resolveRipple(ripple: Ripple, fishLength: number): RippleFrame {
  const life = ripple.ageS / RIPPLE_LIFETIME_S
  const progress = life > 1 ? 1 : life
  const eased = 1 - Math.pow(1 - progress, 2.2)
  return {
    origin: ripple.origin,
    radius: eased * RIPPLE_REACH * fishLength * (0.55 + ripple.strength * 0.45),
    alpha: (1 - progress) * (1 - progress) * ripple.strength,
  }
}
