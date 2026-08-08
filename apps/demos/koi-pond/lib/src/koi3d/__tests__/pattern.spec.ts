import { describe, expect, it } from 'vitest'
import { KOI_PATTERNS, MAX_PATCHES, buildPattern, packPatches } from '../pattern.js'

describe('buildPattern', () => {
  it('draws the same fish from the same seed', () => {
    expect(buildPattern('kohaku', 977)).toEqual(buildPattern('kohaku', 977))
  })

  it('draws a different fish from a different seed', () => {
    expect(buildPattern('kohaku', 977)).not.toEqual(buildPattern('kohaku', 1954))
  })

  it('leaves an ogon unmarked, because its whole point is an even ground', () => {
    expect(buildPattern('ogon', 977).patches).toEqual([])
  })

  it('gives an ogon a metallic ground instead of markings', () => {
    expect(buildPattern('ogon', 977).metallic).toBeGreaterThan(0.4)
  })

  it('gives an asagi its reticulated net', () => {
    expect(buildPattern('asagi', 977).netting).toBeGreaterThan(buildPattern('kohaku', 977).netting)
  })

  it('draws a kohaku in one colour only', () => {
    expect(buildPattern('kohaku', 977).patches.map((patch) => patch.layer)).toEqual(expect.arrayContaining([0]))
  })

  it('draws a sanke in two colours', () => {
    expect(new Set(buildPattern('sanke', 977).patches.map((patch) => patch.layer))).toEqual(new Set([0, 1]))
  })

  it('never draws more markings than the material can composite', () => {
    const overruns = KOI_PATTERNS.filter((pattern) => buildPattern(pattern, 977).patches.length > MAX_PATCHES)
    expect(overruns).toEqual([])
  })

  it('keeps every marking on the koi rather than past its tail', () => {
    const strays = KOI_PATTERNS.flatMap((pattern) => buildPattern(pattern, 977).patches).filter(
      (patch) => patch.station < 0 || patch.station > 1
    )
    expect(strays).toEqual([])
  })

  it('keeps every marking pulled toward the back rather than centred on the belly', () => {
    const strays = KOI_PATTERNS.flatMap((pattern) => buildPattern(pattern, 977).patches).filter((patch) => Math.abs(patch.girth) > 0.35)
    expect(strays).toEqual([])
  })

  it('gives every marking a positive extent, so none collapses to a point', () => {
    const strays = KOI_PATTERNS.flatMap((pattern) => buildPattern(pattern, 977).patches).filter(
      (patch) => patch.lengthSpan <= 0 || patch.girthSpan <= 0
    )
    expect(strays).toEqual([])
  })

  it('spaces a band of markings along the body rather than clumping them', () => {
    const stations = buildPattern('kohaku', 977).patches.map((patch) => patch.station)
    expect(Math.max(...stations) - Math.min(...stations)).toBeGreaterThan(0.3)
  })
})

describe('packPatches', () => {
  it('packs one stream slot per marking the material can composite', () => {
    expect(packPatches(buildPattern('kohaku', 977))[0].length).toBe(MAX_PATCHES * 4)
  })

  it('writes each marking into its own slot', () => {
    const data = buildPattern('showa', 977)
    expect(packPatches(data)[0][0]).toBeCloseTo(data.patches[0]?.station ?? 0, 5)
  })

  it('parks every unused slot off the koi, so an empty pattern paints nothing', () => {
    const [shape] = packPatches(buildPattern('ogon', 977))
    const onBody = Array.from({ length: MAX_PATCHES }, (_unused, index) => shape[index * 4] ?? 0).filter((station) => station > -1)
    expect(onBody).toEqual([])
  })

  it('never emits a zero span, which would divide by zero in the material', () => {
    const [shape] = packPatches(buildPattern('ogon', 977))
    const zeros = Array.from(
      { length: MAX_PATCHES * 2 },
      (_unused, index) => shape[Math.floor(index / 2) * 4 + 2 + (index % 2)] ?? 0
    ).filter((span) => span <= 0)
    expect(zeros).toEqual([])
  })
})
