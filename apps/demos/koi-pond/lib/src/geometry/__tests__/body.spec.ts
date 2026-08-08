import { describe, expect, it } from 'vitest'
import { CAUDAL_STATION, bodyContour, caudalPath, contourPath, dorsalPath, jointAtStation, pectoralPath } from '../body.js'
import { SPINE_JOINTS, createSpine, spineGirth } from '../spine.js'

/** The nose-to-tail length every fixture in this file uses. */
const LENGTH = 120

/** A koi laid out along +x with the nose at the origin. */
const joints = createSpine({ x: 0, y: 0 }, 0, LENGTH).joints

/** Its half-widths, nose first. */
const girth = spineGirth(LENGTH, 0.12)

describe('bodyContour', () => {
  it('walks one point per vertebra down each flank', () => {
    const contour = bodyContour(joints, girth)
    expect({ left: contour.left.length, right: contour.right.length }).toEqual({ left: SPINE_JOINTS, right: SPINE_JOINTS })
  })

  it('puts the two flanks on opposite sides of the centreline', () => {
    const contour = bodyContour(joints, girth)
    const midpoint = Math.floor(SPINE_JOINTS / 2)
    expect(Math.sign(contour.left[midpoint]?.y ?? 0)).toBe(-Math.sign(contour.right[midpoint]?.y ?? 0))
  })

  it('separates the flanks by the full beam at the shoulders', () => {
    const contour = bodyContour(joints, girth)
    const shoulder = jointAtStation(0.4)
    const left = contour.left[shoulder]
    const right = contour.right[shoulder]
    expect(Math.hypot((left?.x ?? 0) - (right?.x ?? 0), (left?.y ?? 0) - (right?.y ?? 0))).toBeCloseTo((girth[shoulder] ?? 0) * 2)
  })

  it('skips a joint the girth array never described', () => {
    expect(bodyContour(joints, [4, 4]).left).toHaveLength(2)
  })
})

describe('contourPath', () => {
  it('opens at the nose and closes the silhouette', () => {
    const path = contourPath(bodyContour(joints, girth))
    expect(path.startsWith('M ') && path.endsWith(' Z')).toBe(true)
  })

  it('threads the outline with curves rather than straight edges', () => {
    expect(contourPath(bodyContour(joints, girth))).toContain('Q ')
  })

  it('emits nothing for a koi with no body', () => {
    expect(contourPath({ left: [], right: [] })).toBe('')
  })

  it('never emits a coordinate the renderer cannot parse', () => {
    expect(contourPath(bodyContour(joints, girth))).not.toContain('NaN')
  })
})

describe('jointAtStation', () => {
  it('reads the nose at the front of the body', () => {
    expect(jointAtStation(0)).toBe(0)
  })

  it('reads the tail at the back of the body', () => {
    expect(jointAtStation(1)).toBe(SPINE_JOINTS - 1)
  })

  it('clamps a station past the tail onto the tail', () => {
    expect(jointAtStation(9)).toBe(SPINE_JOINTS - 1)
  })

  it('clamps a station ahead of the nose onto the nose', () => {
    expect(jointAtStation(-3)).toBe(0)
  })
})

describe('pectoralPath', () => {
  it('draws a closed fin', () => {
    expect(pectoralPath(joints, LENGTH, 0.16, 1, 0.5).endsWith(' Z')).toBe(true)
  })

  it('hangs the two fins on opposite flanks', () => {
    expect(pectoralPath(joints, LENGTH, 0.16, 1, 0.5)).not.toBe(pectoralPath(joints, LENGTH, 0.16, -1, 0.5))
  })

  it('emits nothing when there is no body to hang off', () => {
    expect(pectoralPath([], LENGTH, 0.16, 1, 0.5)).toBe('')
  })
})

describe('caudalPath', () => {
  it('draws a closed tail', () => {
    expect(caudalPath(joints, LENGTH, 0.24).endsWith(' Z')).toBe(true)
  })

  it('trails the tail behind the peduncle rather than ahead of it', () => {
    const path = caudalPath(joints, LENGTH, 0.24)
    const first = Number.parseFloat(path.slice(2).split(' ')[0] ?? '0')
    expect(first).toBeGreaterThan(-LENGTH * (CAUDAL_STATION + 0.2))
  })

  it('emits nothing when there is no body to hang off', () => {
    expect(caudalPath([], LENGTH, 0.24)).toBe('')
  })
})

describe('dorsalPath', () => {
  it('draws a closed ridge', () => {
    expect(dorsalPath(joints, LENGTH, 0.06).endsWith(' Z')).toBe(true)
  })

  it('emits nothing when there is no body to ride on', () => {
    expect(dorsalPath([], LENGTH, 0.06)).toBe('')
  })
})
