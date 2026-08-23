import type { KoiOutline, Vec2 } from '@hyperfrontend/demo-koi-lib'
import { describe, expect, it } from 'vitest'
import { CARET_ORBIT_BODIES, committedHeading, paintCaret } from '../sliding-caret'

/** The head centre every fixture takes its bearings from, in pond space. */
const HEAD: Vec2 = { x: 400, y: 300 }

/** The heading every fixture koi reports it is swimming on, in radians. */
const HEADING = 0.3

/** The nose-to-tail length every fixture koi reports, in pond pixels. */
const BODY_PX = 140

/** How far ahead every fixture koi is anticipating, in pond pixels. */
const REACH_PX = 260

/** The angle the drawn carets ride at, in radians: off both axes, so a spec reading a coordinate is reading the rotation. */
const ANGLE = 0.9

/** The ink the drawn carets are handed, as an `r, g, b` triple. */
const INK = '255, 255, 255'

/** A koi reporting nothing at all about where it has decided to go. */
const REPORTING: KoiOutline = {
  framework: 'vanilla',
  spine: [HEAD],
  girth: [8],
  heading: HEADING,
  speed: 120,
  depth: 2,
  phase: 'relaxed',
}

/** How many points one caret is stroked through: three per chevron, twice over. */
const CARET_POINTS = 6

/**
 * A drawing context that remembers the caret laid on it.
 *
 * @returns The stand-in context, the points the caret ran through, and the ink it went down in.
 */
function recordingContext() {
  const points: Vec2[] = []
  let ink = ''

  const context = {
    lineWidth: 1,
    set strokeStyle(value: string) {
      ink = value
    },
    beginPath: (): void => undefined,
    moveTo: (x: number, y: number): void => {
      points.push({ x, y })
    },
    lineTo: (x: number, y: number): void => {
      points.push({ x, y })
    },
    stroke: (): void => undefined,
  }

  return { context: <CanvasRenderingContext2D>(<unknown>context), points, ink: (): string => ink }
}

/**
 * Draws one caret and reports what went down.
 *
 * @param angle - Where the caret is riding, in radians.
 * @returns The record of the drawing.
 */
function drawn(angle: number) {
  const recorder = recordingContext()
  paintCaret(recorder.context, INK, HEAD.x, HEAD.y, angle, BODY_PX)
  return recorder
}

/**
 * Where one stroked point sits in the caret's own frame.
 *
 * @param points - The points the caret was stroked through.
 * @param index - Which point to read.
 * @returns How far along the caret's angle the point sits, and how far across it.
 */
function local(points: readonly Vec2[], index: number): { along: number; across: number } {
  const point = points[index]
  if (point === undefined) {
    throw new Error(`the caret was not stroked through a point ${index}`)
  }
  const dx = point.x - HEAD.x
  const dy = point.y - HEAD.y
  return { along: dx * Math.cos(ANGLE) + dy * Math.sin(ANGLE), across: dy * Math.cos(ANGLE) - dx * Math.sin(ANGLE) }
}

describe('committedHeading', () => {
  it('reads the decision off the point the koi says it is steering toward', () => {
    const target = { x: HEAD.x + 400, y: HEAD.y + 400 }
    expect(committedHeading({ ...REPORTING, intent: { kind: 'travel', target, reachPx: REACH_PX } }, HEAD)).toBeCloseTo(Math.PI / 4, 12)
  })

  it('reads a vertical manoeuvre off the far end of the advancement it reported', () => {
    const path = [
      { x: HEAD.x + 40, y: HEAD.y },
      { x: HEAD.x + 80, y: HEAD.y - 80 },
    ]
    const intent = <const>{ kind: 'depth-change', target: null, direction: 'above', reachPx: REACH_PX }
    expect(committedHeading({ ...REPORTING, intent, path }, HEAD)).toBeCloseTo(-Math.PI / 4, 12)
  })

  it('falls back to the heading for a koi steering by nothing it reports', () => {
    expect(committedHeading(REPORTING, HEAD)).toBe(HEADING)
  })

  it('falls back to the heading for a koi reporting an advancement with nothing in it', () => {
    expect(committedHeading({ ...REPORTING, path: [] }, HEAD)).toBe(HEADING)
  })

  it('falls back to the heading for a koi sitting on its own steering point', () => {
    const intent = <const>{ kind: 'travel', target: { x: HEAD.x + 0.4, y: HEAD.y }, reachPx: REACH_PX }
    expect(committedHeading({ ...REPORTING, intent }, HEAD)).toBe(HEADING)
  })
})

describe('paintCaret', () => {
  it('strokes a chevron either side of the orbit', () => {
    expect(drawn(ANGLE).points).toHaveLength(CARET_POINTS)
  })

  it('rides the leading apex on the orbit the reporting body sizes', () => {
    expect(local(drawn(ANGLE).points, 1)).toEqual({ along: expect.closeTo(BODY_PX * CARET_ORBIT_BODIES, 9), across: expect.closeTo(0, 9) })
  })

  it('rides the trailing chevron inside the leading one', () => {
    const points = drawn(ANGLE).points
    expect(local(points, 4).along).toBeLessThan(local(points, 1).along)
  })

  it('sweeps each apex the same distance back on both flanks', () => {
    const points = drawn(ANGLE).points
    expect(local(points, 0)).toEqual({
      along: expect.closeTo(local(points, 2).along, 9),
      across: expect.closeTo(-local(points, 2).across, 9),
    })
  })

  it('sets both arms of a chevron behind its apex', () => {
    const points = drawn(ANGLE).points
    expect([local(points, 0).along, local(points, 2).along].map((along) => along < local(points, 1).along)).toEqual([true, true])
  })

  it('turns the whole caret with the angle it is handed', () => {
    const apex = drawn(0).points[1]
    expect(apex).toEqual({ x: expect.closeTo(HEAD.x + BODY_PX * CARET_ORBIT_BODIES, 9), y: expect.closeTo(HEAD.y, 9) })
  })

  it('lays the caret in the ink it is handed', () => {
    expect(drawn(ANGLE).ink().startsWith(`rgba(${INK}, `)).toBe(true)
  })
})
