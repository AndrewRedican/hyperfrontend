import { alignOffset, resolveBoxPosition, resolveDynamicSize, resolveEmbedFallback } from './presentation'

describe('resolveDynamicSize', () => {
  it('targets 0.6 of the viewport height on a wide viewport', () => {
    expect(resolveDynamicSize(1024, 800)).toEqual({ width: 463, height: 480 })
  })

  it('derives the width from the 530/550 aspect ratio', () => {
    expect(resolveDynamicSize(2000, 1100)).toEqual({ width: 636, height: 660 })
  })

  it('shrinks to fit 0.9 of a narrow viewport width preserving the aspect', () => {
    expect(resolveDynamicSize(400, 800)).toEqual({ width: 360, height: 374 })
  })

  it('rounds fractional results to whole pixels', () => {
    expect(resolveDynamicSize(1024, 801)).toEqual({ width: 463, height: 481 })
  })

  it('falls back to the absolute footprint when the viewport width is unmeasurable', () => {
    expect(resolveDynamicSize(0, 800)).toEqual({ width: 530, height: 550 })
  })

  it('falls back to the absolute footprint when the viewport height is unmeasurable', () => {
    expect(resolveDynamicSize(1024, 0)).toEqual({ width: 530, height: 550 })
  })

  it('treats a NaN viewport dimension as unmeasurable', () => {
    expect(resolveDynamicSize(NaN, 800)).toEqual({ width: 530, height: 550 })
  })
})

describe('resolveBoxPosition', () => {
  it('centers both axes when no position is configured', () => {
    expect(resolveBoxPosition(undefined)).toEqual({ vertical: 'center', horizontal: 'center' })
  })

  it('centers both axes for the bare center shorthand', () => {
    expect(resolveBoxPosition('center')).toEqual({ vertical: 'center', horizontal: 'center' })
  })

  it.each(<const>[
    ['top-left', 'start', 'start'],
    ['top-center', 'start', 'center'],
    ['top-right', 'start', 'end'],
    ['center-left', 'center', 'start'],
    ['center-right', 'center', 'end'],
    ['bottom-left', 'end', 'start'],
    ['bottom-center', 'end', 'center'],
    ['bottom-right', 'end', 'end'],
  ])('resolves %s to vertical %s and horizontal %s', (position, vertical, horizontal) => {
    expect(resolveBoxPosition(position)).toEqual({ vertical, horizontal })
  })
})

describe('alignOffset', () => {
  it('anchors a start alignment at the origin', () => {
    expect(alignOffset('start', 1920, 500)).toBe(0)
  })

  it('splits the free space evenly for a center alignment', () => {
    expect(alignOffset('center', 1920, 500)).toBe(710)
  })

  it('pushes an end alignment to the far edge of the free space', () => {
    expect(alignOffset('end', 1920, 500)).toBe(1420)
  })

  it('rounds a fractional centered offset to whole pixels', () => {
    expect(alignOffset('center', 1001, 500)).toBe(251)
  })

  it('rounds a fractional end offset to whole pixels', () => {
    expect(alignOffset('end', 1000.4, 500)).toBe(500)
  })

  it('clamps a centered box larger than its extent to the origin', () => {
    expect(alignOffset('center', 300, 500)).toBe(0)
  })

  it('clamps an end-aligned box larger than its extent to the origin', () => {
    expect(alignOffset('end', 300, 500)).toBe(0)
  })

  it('keeps a start alignment at the origin even when the box overflows', () => {
    expect(alignOffset('start', 300, 500)).toBe(0)
  })
})

describe('resolveEmbedFallback', () => {
  it('keeps a nonzero measured width and derives the height from the viewport aspect', () => {
    expect(resolveEmbedFallback(700, 1000, 500)).toEqual({ width: 700, height: 350 })
  })

  it('fills a missing width from the rounded viewport width', () => {
    expect(resolveEmbedFallback(0, 800.6, 400)).toEqual({ width: 801, height: 360 })
  })

  it('caps the derived height at 0.9 of the viewport height', () => {
    expect(resolveEmbedFallback(1000, 1000, 500)).toEqual({ width: 1000, height: 450 })
  })

  it('rounds a fractional derived height', () => {
    expect(resolveEmbedFallback(701, 1000, 500)).toEqual({ width: 701, height: 351 })
  })

  it('keeps the measured width when the viewport width is unmeasurable', () => {
    expect(resolveEmbedFallback(300, 0, 500)).toEqual({ width: 300, height: 550 })
  })

  it('treats a missing viewport height as unmeasurable', () => {
    expect(resolveEmbedFallback(300, 1000, 0)).toEqual({ width: 300, height: 550 })
  })

  it('falls back to the absolute footprint when nothing is measurable', () => {
    expect(resolveEmbedFallback(0, 0, 0)).toEqual({ width: 530, height: 550 })
  })
})
