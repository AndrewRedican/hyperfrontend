import type { KoiIntent, Vec2 } from '@hyperfrontend/demo-koi-lib'
import { describe, expect, it } from 'vitest'
import { CARET_ORBIT_BODIES, commitment, paintCaret } from '../sliding-caret'

/** The head centre every fixture takes its bearings from, in pond space. */
const HEAD: Vec2 = { x: 400, y: 300 }

/** The nose-to-tail length every fixture koi reports, in pond pixels. */
const BODY_PX = 140

/** How far the fixture koi's own head and beam reach from that anchor, in pond pixels. */
const STANDOFF_PX = 33

/** The angle the drawn carets ride at, in radians: off both axes, so a spec reading a coordinate is reading the rotation. */
const ANGLE = 0.9

/** The ink the drawn carets are handed, as an `r, g, b` triple. */
const INK = '255, 255, 255'

/** The decision every fixture koi reports unless a spec asks for another. */
const TRAVELLING: KoiIntent = { kind: 'travel', heading: ANGLE, gain: 1, target: null, reachPx: 260, clearancePx: 90 }

/** How many points one caret is stroked through: three per chevron, both in one path. */
const CARET_POINTS = 6

/** Where the leading apex rides, in pond pixels: the koi's own head and beam, plus its orbit. */
const APEX_PX = STANDOFF_PX + BODY_PX * CARET_ORBIT_BODIES

/**
 * A drawing context that remembers the caret laid on it.
 *
 * @returns The stand-in context, the points stroked and filled, and the ink each went down in.
 */
function recordingContext() {
  const stroked: Vec2[] = []
  const filled: Vec2[] = []
  let path: Vec2[] = []
  let ink = ''
  let paint = ''

  const context = {
    lineWidth: 1,
    set strokeStyle(value: string) {
      ink = value
    },
    set fillStyle(value: string) {
      paint = value
    },
    beginPath: (): void => {
      path = []
    },
    closePath: (): void => undefined,
    moveTo: (x: number, y: number): void => {
      path.push({ x, y })
    },
    lineTo: (x: number, y: number): void => {
      path.push({ x, y })
    },
    stroke: (): void => {
      stroked.push(...path)
    },
    fill: (): void => {
      filled.push(...path)
    },
  }

  return {
    context: <CanvasRenderingContext2D>(<unknown>context),
    stroked,
    filled,
    ink: (): string => ink,
    paint: (): string => paint,
  }
}

/**
 * Draws one caret and reports what went down.
 *
 * @param angle - Where the caret is riding, in radians.
 * @param intent - What the koi reports it is steering by.
 * @param body - The nose-to-tail length the koi reports, in pond pixels.
 * @returns The record of the drawing.
 */
function drawn(angle: number, intent: KoiIntent = TRAVELLING, body: number = BODY_PX) {
  const recorder = recordingContext()
  paintCaret(recorder.context, INK, { x: HEAD.x, y: HEAD.y, angle, standoff: STANDOFF_PX, body, intent })
  return recorder
}

/**
 * Where one drawn point sits in the caret's own frame.
 *
 * @param points - The points the caret was drawn through.
 * @param index - Which point to read.
 * @returns How far along the caret's angle the point sits, and how far across it.
 */
function local(points: readonly Vec2[], index: number): { along: number; across: number } {
  const point = points[index]
  if (point === undefined) {
    throw new Error(`the caret was not drawn through a point ${index}`)
  }
  const dx = point.x - HEAD.x
  const dy = point.y - HEAD.y
  return { along: dx * Math.cos(ANGLE) + dy * Math.sin(ANGLE), across: dy * Math.cos(ANGLE) - dx * Math.sin(ANGLE) }
}

/**
 * The chevron a run of drawn points describes, in the caret's own frame.
 *
 * @param points - The points the caret was drawn through.
 * @param from - Where that chevron's three points start.
 * @returns Its apex, how far its arms sweep back, and half its height.
 */
function chevronOf(points: readonly Vec2[], from: number): { apex: number; sweep: number; half: number } {
  const apex = local(points, from + 1)
  const arm = local(points, from + 2)
  return { apex: apex.along, sweep: apex.along - arm.along, half: Math.abs(arm.across) }
}

describe('commitment', () => {
  it('reads a drift as nothing decided and a committed manoeuvre as everything', () => {
    expect([commitment(0.12), commitment(0.55), commitment(1.6)]).toEqual([0, 1, 1])
  })

  it('climbs between the two rather than stepping', () => {
    expect(commitment(0.3)).toBeGreaterThan(commitment(0.2))
    expect(commitment(0.3)).toBeLessThan(commitment(0.5))
  })
})

describe('paintCaret', () => {
  it('strokes both chevrons in one mark', () => {
    expect(drawn(ANGLE).stroked).toHaveLength(CARET_POINTS)
  })

  it('rides the leading apex clear of the head the reporting koi described', () => {
    expect(local(drawn(ANGLE).stroked, 1)).toEqual({ along: expect.closeTo(APEX_PX, 9), across: expect.closeTo(0, 9) })
  })

  it('nests the inner chevron wholly inside the outer one', () => {
    const points = drawn(ANGLE).stroked
    const outer = chevronOf(points, 0)
    const inner = chevronOf(points, 3)
    expect(inner.apex).toBeLessThan(outer.apex)
    expect(inner.half).toBeLessThan(outer.half)
    // how: The inner arm ends behind the outer chevron's own arm at the same height, which is what makes the smaller shape sit inside the larger rather than beside it.
    expect(inner.apex - inner.sweep).toBeLessThan(outer.apex - outer.sweep * (inner.half / outer.half))
  })

  it('sweeps each apex the same distance back on both flanks', () => {
    const points = drawn(ANGLE).stroked
    expect(local(points, 0)).toEqual({
      along: expect.closeTo(local(points, 2).along, 9),
      across: expect.closeTo(-local(points, 2).across, 9),
    })
  })

  it('sets both arms of a chevron behind its apex', () => {
    const points = drawn(ANGLE).stroked
    expect([local(points, 0).along, local(points, 2).along].map((along) => along < local(points, 1).along)).toEqual([true, true])
  })

  it('turns the whole caret with the angle it is handed', () => {
    const apex = drawn(0).stroked[1]
    expect(apex).toEqual({ x: expect.closeTo(HEAD.x + APEX_PX, 9), y: expect.closeTo(HEAD.y, 9) })
  })

  it('scales the chevrons with the koi that reported them', () => {
    const small = chevronOf(drawn(ANGLE, TRAVELLING, BODY_PX).stroked, 0)
    const large = chevronOf(drawn(ANGLE, TRAVELLING, BODY_PX * 2).stroked, 0)
    expect(large.half).toBeGreaterThan(small.half)
    expect(large.sweep).toBeGreaterThan(small.sweep)
  })

  it('holds the smallest koi to a mark that can still be read', () => {
    // why: A card-sized pond floors its koi at a legible length, and the mark on one has to stay a shape rather than shrinking into a speck with it.
    expect(chevronOf(drawn(ANGLE, TRAVELLING, 10).stroked, 0).half).toBeGreaterThan(2)
  })

  it('leaves the core open while the koi is only travelling', () => {
    expect(drawn(ANGLE).filled).toEqual([])
  })

  it('fills the core once the koi has committed to an avoidance', () => {
    const drawing = drawn(ANGLE, { ...TRAVELLING, kind: 'avoid' })
    expect(drawing.filled).toHaveLength(3)
    expect(drawing.paint()).toBe(drawing.ink())
  })

  it('fills the core for a koi passing at another depth', () => {
    expect(drawn(ANGLE, { ...TRAVELLING, kind: 'depth-change', direction: 'above' }).filled).toHaveLength(3)
  })

  it('lays the caret in the ink it is handed', () => {
    expect(drawn(ANGLE).ink().startsWith(`rgba(${INK}, `)).toBe(true)
  })

  it('lays a drifting koi fainter than a committed one', () => {
    const alphaOf = (gain: number): number => {
      const ink = drawn(ANGLE, { ...TRAVELLING, gain }).ink()
      return Number(ink.slice(ink.lastIndexOf(' ') + 1, -1))
    }
    expect(alphaOf(0.12)).toBeLessThan(alphaOf(1))
  })
})
