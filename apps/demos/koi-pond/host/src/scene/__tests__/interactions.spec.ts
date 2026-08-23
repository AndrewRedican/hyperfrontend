import type { KoiIntent, KoiOutline, KoiPhase, Vec2 } from '@hyperfrontend/demo-koi-lib'
import { describe, expect, it } from 'vitest'
import { advanceSpine, createSpine, outlineContains, sampleSpine, spineGirth } from '@hyperfrontend/demo-koi-lib'
import { CONE_HALF_RAD, CONE_WEDGES, HEAD_CENTRE_ALONG, createInteractionsPainter, headCentre, spineLength } from '../interactions'
import { PEARL_MAX, PEARL_SPACING_BODIES } from '../pearl-trace'
import { committedHeading } from '../sliding-caret'
import { VIEW, anchorOf, caretAngle, frameOf, painted, recordingOverlay } from './overlay-recorder'

/** The nose-to-tail length every koi in these fixtures swims at, in pond pixels. */
const BODY_PX = 140

/** The beam a sculpted koi carries, as a fraction of its length. */
const GIRTH_RATIO = 0.115

/** How fast a fixture koi travels, in pond pixels per second. */
const SPEED_PX_S = 210

/** The frame step a fixture spine is settled over, in seconds. */
const STEP_S = 1 / 60

/** How many frames a fixture koi swims before it reports, long enough for its chain to settle into the pose. */
const SETTLE_FRAMES = 90

/** How far ahead every fixture koi is anticipating, in pond pixels. */
const REACH_PX = 260

/** Which spine sample the fixtures read as the middle of the body. */
const BODY_CENTRE_SAMPLE = 2

/** The three poses the anchor has to survive, and how fast the heading winds through each. */
const POSES: readonly [string, number][] = [
  ['a straight run', 0],
  ['a mid-turn', 0.45],
  ['a hard turn', 1.1],
]

/** The travel decision every fixture koi reports unless a spec asks for another. */
const TRAVELLING: KoiIntent = { kind: 'travel', target: { x: 2600, y: 400 }, reachPx: REACH_PX }

/** A waypoint well off any fixture koi's course, so a bearing taken to it is unmistakably a decision. */
const OFF_COURSE: Vec2 = { x: 900, y: 3400 }

/** One decision of every shape a koi can report, so no mark can be read against only part of the vocabulary. */
const INTENTS: readonly [string, KoiIntent][] = [
  ['travel', TRAVELLING],
  ['avoid', { kind: 'avoid', target: { x: 200, y: 700 }, reachPx: REACH_PX }],
  ['a pass above', { kind: 'depth-change', target: null, direction: 'above', reachPx: REACH_PX }],
  ['a pass below', { kind: 'depth-change', target: null, direction: 'below', reachPx: REACH_PX }],
]

/**
 * Swims a koi through a constant turn and reports the outline it ends on.
 *
 * The chain is the real one: a nose driven around an arc with the follow
 * constraint and the undulation laid over it, so a pose here bends the way a
 * koi in the water bends rather than the way a fixture author imagines it.
 *
 * @param turnRate - How fast the heading winds, in radians per second.
 * @param intent - What the koi reports it is steering by.
 * @returns The koi's reported outline.
 */
function swum(turnRate: number, intent: KoiIntent = TRAVELLING): KoiOutline {
  const phase: KoiPhase = turnRate === 0 ? 'relaxed' : 'turning'
  let heading = 0
  let nose: Vec2 = { x: 600, y: 400 }
  let spine = createSpine(nose, heading, BODY_PX)
  for (let frame = 0; frame < SETTLE_FRAMES; frame += 1) {
    heading += turnRate * STEP_S
    nose = { x: nose.x + Math.cos(heading) * SPEED_PX_S * STEP_S, y: nose.y + Math.sin(heading) * SPEED_PX_S * STEP_S }
    spine = advanceSpine(spine, { nose, length: BODY_PX, speed: SPEED_PX_S, phase, dt: STEP_S, reducedMotion: false })
  }
  return {
    framework: 'vanilla',
    spine: sampleSpine(spine.joints, 5),
    girth: sampleSpine(spineGirth(BODY_PX, GIRTH_RATIO), 5),
    heading,
    speed: SPEED_PX_S,
    depth: 2,
    phase,
    intent,
  }
}

/**
 * Reads one spine sample, refusing a fixture that reports too few.
 *
 * @param outline - The koi's reported outline.
 * @param index - Which sample to read, nose first.
 * @returns The sample in pond space.
 */
function sampleAt(outline: KoiOutline, index: number): Vec2 {
  const sample = outline.spine[index]
  if (sample === undefined) {
    throw new Error(`the fixture outline reports no spine sample ${index}`)
  }
  return sample
}

/**
 * How far along a run a point projects, as a share of the run.
 *
 * @param point - The point to project.
 * @param from - Where the run starts.
 * @param to - Where the run ends.
 * @returns The share; 0 at `from` and 1 at `to`.
 */
function projected(point: Vec2, from: Vec2, to: Vec2): number {
  const dx = to.x - from.x
  const dy = to.y - from.y
  return ((point.x - from.x) * dx + (point.y - from.y) * dy) / (dx * dx + dy * dy)
}

/**
 * Gives a koi the advancement it has committed to: a straight run one pearl-spacing per point.
 *
 * A path sampled at exactly the spacing the trace lays pearls at puts a pearl
 * on every reported point, so a spec can read the drawn chain straight off the
 * report instead of re-deriving where the arc lengths landed.
 *
 * @param outline - The koi's reported outline.
 * @returns The same outline, reporting its advancement.
 */
function advancing(outline: KoiOutline): KoiOutline {
  const nose = sampleAt(outline, 0)
  const step = spineLength(outline.spine) * PEARL_SPACING_BODIES
  return {
    ...outline,
    path: Array.from({ length: 20 }, (_unused, index) => ({
      x: nose.x + Math.cos(outline.heading) * step * (index + 1),
      y: nose.y + Math.sin(outline.heading) * step * (index + 1),
    })),
  }
}

/**
 * The same koi, further along its heading and reporting from where it has got to.
 *
 * @param outline - The koi's reported outline.
 * @param byPx - How far it has swum, in pond pixels.
 * @returns The koi's next outline.
 */
function advanced(outline: KoiOutline, byPx: number): KoiOutline {
  const dx = Math.cos(outline.heading) * byPx
  const dy = Math.sin(outline.heading) * byPx
  return advancing({ ...outline, spine: outline.spine.map((point) => ({ x: point.x + dx, y: point.y + dy })) })
}

/**
 * Where a fill went down, past the last place the arc-length arithmetic is exact.
 *
 * @param fill - The recorded fill.
 * @returns The centre, as a comparable pair.
 */
function centre(fill: { x: number; y: number }): string {
  return `${fill.x.toFixed(3)},${fill.y.toFixed(3)}`
}

describe('spineLength', () => {
  it('measures the run of the reported chain', () => {
    expect(
      spineLength([
        { x: 0, y: 0 },
        { x: 30, y: 40 },
        { x: 30, y: 90 },
      ])
    ).toBe(100)
  })

  it('measures nothing across a chain of one sample', () => {
    expect(spineLength([{ x: 12, y: 8 }])).toBe(0)
  })
})

describe('headCentre', () => {
  it('reports nothing for an outline carrying no body', () => {
    expect(headCentre({ ...swum(0), spine: [] })).toBeNull()
  })

  it('pulls the anchor its share of the reported body back along the heading', () => {
    const outline = swum(0)
    const nose = sampleAt(outline, 0)
    const back = spineLength(outline.spine) * HEAD_CENTRE_ALONG
    expect(anchorOf(outline)).toEqual({ x: nose.x - Math.cos(outline.heading) * back, y: nose.y - Math.sin(outline.heading) * back })
  })

  it('puts the anchor behind the nose rather than ahead of it', () => {
    const outline = swum(0)
    const nose = sampleAt(outline, 0)
    const anchor = anchorOf(outline)
    expect((anchor.x - nose.x) * Math.cos(outline.heading) + (anchor.y - nose.y) * Math.sin(outline.heading)).toBeLessThan(0)
  })

  it.each(POSES)('keeps the anchor inside the silhouette through %s', (_pose, turnRate) => {
    const outline = swum(turnRate)
    expect(outlineContains(anchorOf(outline), outline)).toBe(true)
  })

  it.each(POSES)('keeps the anchor between the nose and the body centre through %s', (_pose, turnRate) => {
    const outline = swum(turnRate)
    const along = projected(anchorOf(outline), sampleAt(outline, 0), sampleAt(outline, BODY_CENTRE_SAMPLE))
    expect([along > 0, along < 1]).toEqual([true, true])
  })
})

describe('the cone wedges', () => {
  it('span the cone from one lateral edge to the other', () => {
    expect([CONE_WEDGES[0]?.from, CONE_WEDGES[CONE_WEDGES.length - 1]?.to]).toEqual([-CONE_HALF_RAD, CONE_HALF_RAD])
  })

  it('leave no water between neighbours', () => {
    expect(CONE_WEDGES.slice(1).map((wedge) => wedge.from)).toEqual(CONE_WEDGES.slice(0, -1).map((wedge) => wedge.to))
  })

  it('carry the ink down the middle and next to none at either edge', () => {
    const inks = CONE_WEDGES.map((wedge) => wedge.ink)
    expect(Math.max(...inks)).toBeGreaterThan(0.95)
    expect(Math.max(inks[0] ?? 1, inks[inks.length - 1] ?? 1)).toBeLessThan(0.05)
  })

  it('read the same on both flanks', () => {
    const inks = CONE_WEDGES.map((wedge) => Number(wedge.ink.toPrecision(12)))
    expect(inks).toEqual([...inks].reverse())
  })

  it('never step by enough for an edge to show between two of them', () => {
    const steps = CONE_WEDGES.slice(1).map((wedge, index) => Math.abs(wedge.ink - (CONE_WEDGES[index]?.ink ?? 0)))
    expect(Math.max(...steps)).toBeLessThan(0.07)
  })
})

describe('the painted cone', () => {
  it('hangs every wedge off the head centre rather than the nose', () => {
    const outline = swum(1.1)
    const anchor = anchorOf(outline)
    const centres = painted(outline)
      .wedges()
      .map((wedge) => `${wedge.x},${wedge.y}`)
    expect([...new Set(centres)]).toEqual([`${anchor.x - VIEW.x},${anchor.y - VIEW.y}`])
  })

  it('sweeps its wedges across the whole cone', () => {
    const outline = swum(0.45)
    const wedges = painted(outline).wedges()
    expect([Math.min(...wedges.map((wedge) => wedge.from)), Math.max(...wedges.map((wedge) => wedge.to))]).toEqual([
      outline.heading - CONE_HALF_RAD,
      outline.heading + CONE_HALF_RAD,
    ])
  })

  it('thins its wedges away toward the lateral edges', () => {
    const alphas = painted(swum(0))
      .wedges()
      .map((wedge) => wedge.alpha)
    const flanks = Math.max(alphas[0] ?? 1, alphas[alphas.length - 1] ?? 1)
    expect(Math.max(...alphas)).toBeGreaterThan(flanks)
    expect(flanks).toBeLessThan(0.05)
  })

  it('runs its ink out entirely at the horizon', () => {
    const stops = painted(swum(0)).stops
    expect(stops[stops.length - 1]).toEqual({ at: 1, color: 'rgba(255, 255, 255, 0)' })
  })

  it.each(INTENTS)('draws the cone in one ink whatever a koi decided, here %s', (_kind, intent) => {
    const inks = painted(swum(0, intent)).stops.map((stop) => stop.color.slice(0, stop.color.lastIndexOf(',')))
    expect([...new Set(inks)]).toEqual(['rgba(255, 255, 255'])
  })

  it('leaves no outline around the cone', () => {
    // how: The caret is the only stroke the overlay lays, so a second one could only be an edge drawn around the fill.
    expect(painted(swum(0)).strokes).toHaveLength(1)
  })

  it('draws nothing for a held koi', () => {
    const overlay = painted({ ...swum(0), intent: undefined })
    expect([overlay.wedges().length, overlay.strokes.length]).toEqual([0, 0])
  })

  it('draws nothing for a koi reporting no body', () => {
    const overlay = painted({ ...swum(0), spine: [], girth: [] })
    expect([overlay.wedges().length, overlay.strokes.length]).toEqual([0, 0])
  })
})

describe('the painted trace', () => {
  it('lays a pearl wherever the koi said it would be', () => {
    const outline = advancing(swum(0))
    expect(painted(outline).pearls().map(centre)).toEqual(
      (outline.path ?? []).slice(0, PEARL_MAX).map((point) => centre({ x: point.x - VIEW.x, y: point.y - VIEW.y }))
    )
  })

  it.each(INTENTS)('lays the trace in the ink the cone is drawn in whatever a koi decided, here %s', (_kind, intent) => {
    const inks = painted(advancing(swum(0, intent)))
      .pearls()
      .map((pearl) => pearl.ink.slice(0, pearl.ink.lastIndexOf(',')))
    expect([...new Set(inks)]).toEqual(['rgba(255, 255, 255'])
  })

  it('draws every pearl between five and six pixels across', () => {
    const widths = painted(advancing(swum(0)))
      .pearls()
      .map((pearl) => pearl.radius * 2)
    expect([Math.min(...widths) >= 5, Math.max(...widths) <= 6]).toEqual([true, true])
  })

  it('thins the trace out with every pearl further from the nose', () => {
    const alphas = painted(advancing(swum(0)))
      .pearls()
      .map((pearl) => Number(pearl.ink.slice(pearl.ink.lastIndexOf(' ') + 1, -1)))
    expect(alphas).toEqual([...alphas].sort((first, second) => second - first))
  })

  it('lays no trace for a koi reporting no advancement', () => {
    expect(painted(swum(0)).pearls()).toEqual([])
  })

  it('holds each koi of a framework to a chain of its own', () => {
    const overlay = recordingOverlay()
    const painter = createInteractionsPainter(overlay.canvas)
    const first = advancing(swum(0))
    const twin = advancing({ ...swum(0), spine: swum(0).spine.map((point) => ({ x: point.x, y: point.y + 300 })) })
    const frame = (koi: KoiOutline, other: KoiOutline) => ({
      width: 800,
      height: 600,
      view: VIEW,
      pixelRatio: 1,
      dt: STEP_S,
      shoal: [
        { id: <const>'vanilla:0', outline: koi },
        { id: <const>'vanilla:1', outline: other },
      ],
    })
    painter.paint(frame(first, twin))
    const placed = overlay.pearls().map(centre)
    painter.paint(frame(advanced(first, 4), advanced(twin, 4)))
    expect(
      overlay
        .pearls()
        .map(centre)
        .slice(PEARL_MAX * 2)
    ).toEqual(placed)
  })
})

describe('the painted caret', () => {
  it('starts a koi on the heading it is already committed to', () => {
    const outline = swum(0, { kind: 'travel', target: OFF_COURSE, reachPx: REACH_PX })
    expect(caretAngle(painted(outline).strokes, outline)).toBeCloseTo(committedHeading(outline, anchorOf(outline)), 9)
  })

  it('rides a caret on every koi in the shoal at once', () => {
    const overlay = recordingOverlay()
    const twin = { ...swum(0), spine: swum(0).spine.map((point) => ({ x: point.x, y: point.y + 300 })) }
    createInteractionsPainter(overlay.canvas).paint({
      width: 800,
      height: 600,
      view: VIEW,
      pixelRatio: 1,
      dt: STEP_S,
      shoal: [
        { id: <const>'vanilla:0', outline: swum(0) },
        { id: <const>'vanilla:1', outline: twin },
      ],
    })
    expect(overlay.strokes).toHaveLength(2)
  })

  it.each(INTENTS)('lays every stroke in the single overlay ink whatever a koi decided, here %s', (_kind, intent) => {
    const inks = painted(advancing(swum(0, intent))).strokes.map((stroke) => stroke.ink.slice(0, stroke.ink.lastIndexOf(',')))
    expect([...new Set(inks)]).toEqual(['rgba(255, 255, 255'])
  })
})

describe('switching the overlay off', () => {
  it('wipes the whole canvas', () => {
    const overlay = recordingOverlay()
    const painter = createInteractionsPainter(overlay.canvas)
    painter.paint(frameOf(swum(0)))
    painter.clear()
    expect(overlay.wipes[overlay.wipes.length - 1]).toEqual({ width: 800, height: 600 })
  })

  it('leaves no caret riding for the next time it comes on', () => {
    const overlay = recordingOverlay()
    const painter = createInteractionsPainter(overlay.canvas)
    const decided = swum(0, { kind: 'avoid', target: OFF_COURSE, reachPx: REACH_PX })
    painter.paint(frameOf(swum(0)))
    painter.clear()
    painter.paint(frameOf(decided))
    expect(caretAngle(overlay.strokes, decided)).toBeCloseTo(committedHeading(decided, anchorOf(decided)), 9)
  })
})
