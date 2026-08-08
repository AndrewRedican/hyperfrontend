import { describe, expect, it } from 'vitest'
import { sampleSection, sectionPoint } from '../anatomy.js'
import { DEFAULT_PHYSICAL } from '../config.js'

/** Walks the body and returns the station where a section field is largest. */
function peakStation(read: (station: number) => number): number {
  let best = 0
  let peak = -Infinity
  for (let step = 0; step <= 200; step += 1) {
    const station = step / 200
    const value = read(station)
    if (value > peak) {
      peak = value
      best = station
    }
  }
  return best
}

describe('sampleSection', () => {
  it('puts the koi at its widest across the shoulders', () => {
    expect(peakStation((station) => sampleSection(DEFAULT_PHYSICAL, station).halfWidth)).toBeCloseTo(0.33, 1)
  })

  it('puts the koi at its deepest behind the shoulders', () => {
    expect(peakStation((station) => sampleSection(DEFAULT_PHYSICAL, station).top)).toBeCloseTo(0.42, 1)
  })

  it('carries more of the body above the axis than below it at midships', () => {
    const section = sampleSection(DEFAULT_PHYSICAL, 0.42)
    expect(section.top).toBeGreaterThan(section.bottom)
  })

  it('is deeper than it is wide, as a laterally compressed fish is', () => {
    const section = sampleSection(DEFAULT_PHYSICAL, 0.42)
    expect(section.top + section.bottom).toBeGreaterThan(section.halfWidth * 2)
  })

  it('flattens the top of the head more than the top of the peduncle', () => {
    expect(sampleSection(DEFAULT_PHYSICAL, 0.15).cornerTop).toBeGreaterThan(sampleSection(DEFAULT_PHYSICAL, 0.95).cornerTop)
  })

  it('narrows monotonically from the shoulders to the tail', () => {
    const widths = Array.from({ length: 40 }, (_unused, index) => sampleSection(DEFAULT_PHYSICAL, 0.4 + (index / 39) * 0.6).halfWidth)
    expect(widths.every((width, index) => index === 0 || width <= (widths[index - 1] ?? 0) + 1e-9)).toBe(true)
  })

  it('leaves the peduncle substantial rather than tapering it to a point', () => {
    expect(sampleSection(DEFAULT_PHYSICAL, 1).halfWidth).toBeGreaterThan(sampleSection(DEFAULT_PHYSICAL, 0.33).halfWidth * 0.2)
  })

  it('widens the head when the head width knob is raised', () => {
    const wider = sampleSection({ ...DEFAULT_PHYSICAL, head: { ...DEFAULT_PHYSICAL.head, width: 1.4 } }, 0.14)
    expect(wider.halfWidth).toBeGreaterThan(sampleSection(DEFAULT_PHYSICAL, 0.14).halfWidth * 1.1)
  })

  it('leaves the tail alone when the head width knob is raised', () => {
    const wider = sampleSection({ ...DEFAULT_PHYSICAL, head: { ...DEFAULT_PHYSICAL.head, width: 1.4 } }, 0.85)
    expect(wider.halfWidth).toBeCloseTo(sampleSection(DEFAULT_PHYSICAL, 0.85).halfWidth, 6)
  })

  it('leaves the head alone when the peduncle width knob is dropped', () => {
    const thinner = sampleSection({ ...DEFAULT_PHYSICAL, peduncleWidth: 0.5 }, 0.15)
    expect(thinner.halfWidth).toBeCloseTo(sampleSection(DEFAULT_PHYSICAL, 0.15).halfWidth, 6)
  })

  it('thins the peduncle when the peduncle width knob is dropped', () => {
    const thinner = sampleSection({ ...DEFAULT_PHYSICAL, peduncleWidth: 0.5 }, 1)
    expect(thinner.halfWidth).toBeLessThan(sampleSection(DEFAULT_PHYSICAL, 1).halfWidth * 0.6)
  })

  it('keeps the dorsal ridge off the head, where the back is flat', () => {
    expect(sampleSection(DEFAULT_PHYSICAL, 0.1).ridge).toBe(0)
  })
})

describe('sectionPoint', () => {
  it('places the dorsal midline a full height above the axis', () => {
    const section = sampleSection({ ...DEFAULT_PHYSICAL, dorsalRidge: 0 }, 0.42)
    expect(sectionPoint(section, 0).y).toBeCloseTo(section.rise + section.top, 5)
  })

  it('places the belly a full depth below the axis', () => {
    const section = sampleSection(DEFAULT_PHYSICAL, 0.42)
    expect(sectionPoint(section, 0.5).y).toBeCloseTo(section.rise - section.bottom, 5)
  })

  it('places the left flank a full half-width out', () => {
    const section = sampleSection(DEFAULT_PHYSICAL, 0.42)
    expect(sectionPoint(section, 0.25).z).toBeCloseTo(section.halfWidth, 5)
  })

  it('mirrors the right flank onto the left', () => {
    const section = sampleSection(DEFAULT_PHYSICAL, 0.42)
    expect(sectionPoint(section, 0.75).z).toBeCloseTo(-sectionPoint(section, 0.25).z, 6)
  })

  it('is bilaterally symmetric at every position around the body', () => {
    const section = sampleSection(DEFAULT_PHYSICAL, 0.3)
    const mismatches = Array.from({ length: 64 }, (_unused, index) => (index + 1) / 130).filter(
      (theta) => Math.abs(sectionPoint(section, theta).y - sectionPoint(section, 1 - theta).y) > 1e-9
    )
    expect(mismatches).toEqual([])
  })

  it('closes on itself, so the ring has no seam', () => {
    const section = sampleSection(DEFAULT_PHYSICAL, 0.42)
    expect(sectionPoint(section, 1)).toEqual({
      y: expect.closeTo(sectionPoint(section, 0).y, 6),
      z: expect.closeTo(sectionPoint(section, 0).z, 6),
    })
  })

  it('lifts a ridge above the plain section when the dorsal ridge knob is raised', () => {
    const ridged = sampleSection({ ...DEFAULT_PHYSICAL, dorsalRidge: 1 }, 0.42)
    expect(sectionPoint(ridged, 0).y).toBeGreaterThan(sectionPoint(sampleSection({ ...DEFAULT_PHYSICAL, dorsalRidge: 0 }, 0.42), 0).y)
  })
})
