import type { KoiState } from '../../motion/koi-motion.js'
import type { PondEnvironment } from '../types.js'
import { describe, expect, it } from 'vitest'
import { cardAnchor, cardTransform } from '../card-anchor.js'

/** A pond whose visible window starts at (100, 50) and shows 800 by 600. */
const POND: PondEnvironment = {
  width: 2000,
  height: 1200,
  margin: 189,
  fishLength: 180,
  view: { x: 100, y: 50, width: 800, height: 600 },
  depthLevels: 5,
  reducedMotion: false,
}

/** The card footprint the golden cases clamp. */
const SIZE = { width: 220, height: 120 }

/** A koi whose head sits at the given pond point. */
function koiAt(x: number, y: number): KoiState {
  return {
    position: { x, y },
    heading: 0,
    speed: 40,
    turnVelocity: 0,
    phase: 'relaxed',
    depth: 3,
    length: 180,
    spine: { joints: [{ x, y }], centreline: [{ x, y }], wavePhase: 0 },
  }
}

describe('cardAnchor', () => {
  it('parks the card off the shoulder of a mid-window koi', () => {
    const at = cardAnchor(koiAt(500, 350), POND, SIZE)
    expect(at.x).toBeCloseTo(421.6, 6)
    expect(at.y).toBeCloseTo(231.6, 6)
  })

  it('holds the margin at the left edge', () => {
    const at = cardAnchor(koiAt(60, 350), POND, SIZE)
    expect(at.x).toBe(8)
    expect(at.y).toBeCloseTo(231.6, 6)
  })

  it('keeps the whole card inside at the right edge', () => {
    const at = cardAnchor(koiAt(850, 350), POND, SIZE)
    expect(at.x).toBe(572)
    expect(at.y).toBeCloseTo(231.6, 6)
  })

  it('holds the margin at the top edge', () => {
    const at = cardAnchor(koiAt(500, 80), POND, SIZE)
    expect(at.x).toBeCloseTo(421.6, 6)
    expect(at.y).toBe(8)
  })

  it('keeps the whole card inside at the bottom edge', () => {
    const at = cardAnchor(koiAt(500, 640), POND, SIZE)
    expect(at.x).toBeCloseTo(421.6, 6)
    expect(at.y).toBe(472)
  })

  it('clamps both axes in every corner', () => {
    expect(cardAnchor(koiAt(60, 80), POND, SIZE)).toEqual({ x: 8, y: 8 })
    expect(cardAnchor(koiAt(850, 80), POND, SIZE)).toEqual({ x: 572, y: 8 })
    expect(cardAnchor(koiAt(60, 640), POND, SIZE)).toEqual({ x: 8, y: 472 })
    expect(cardAnchor(koiAt(850, 640), POND, SIZE)).toEqual({ x: 572, y: 472 })
  })

  it('pins an oversized card to the margin rather than off screen', () => {
    const at = cardAnchor(koiAt(500, 350), POND, { width: 900, height: 700 })
    expect(at).toEqual({ x: 8, y: 8 })
  })

  it('falls back to the nose when the spine has no joints yet', () => {
    const koi = koiAt(500, 350)
    koi.spine = { joints: [], centreline: [], wavePhase: 0 }
    const at = cardAnchor(koi, POND, SIZE)
    expect(at.x).toBeCloseTo(421.6, 6)
    expect(at.y).toBeCloseTo(231.6, 6)
  })
})

describe('cardTransform', () => {
  it('formats a position as a one-decimal translate', () => {
    expect(cardTransform({ x: 12.34, y: 8 })).toBe('translate(12.3px, 8.0px)')
  })
})
