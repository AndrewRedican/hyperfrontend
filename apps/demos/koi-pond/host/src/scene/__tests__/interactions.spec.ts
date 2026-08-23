import type { KoiIntent, KoiOutline, KoiPhase, Vec2 } from '@hyperfrontend/demo-koi-lib'
import { describe, expect, it } from 'vitest'
import { advanceSpine, createSpine, outlineContains, sampleSpine, spineGirth } from '@hyperfrontend/demo-koi-lib'
import { FIELD_STANDOFF_BODIES, HEAD_CENTRE_ALONG, beamOf, createInteractionsPainter, headCentre, spineLength } from '../interactions'
import { PEARL_MAX, PEARL_SPACING_BODIES } from '../pearl-trace'
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

/** How near a neighbour has to pass a fixture koi to matter, in pond pixels. */
const CLEARANCE_PX = 110

/** Which spine sample the fixtures read as the middle of the body. */
const BODY_CENTRE_SAMPLE = 2

/** The three poses the anchor has to survive, and how fast the heading winds through each. */
const POSES: readonly [string, number][] = [
  ['a straight run', 0],
  ['a mid-turn', 0.45],
  ['a hard turn', 1.1],
]

/** The travel decision every fixture koi reports unless a spec asks for another. */
const TRAVELLING: KoiIntent = {
  kind: 'travel',
  heading: 0,
  gain: 1,
  target: { x: 2600, y: 400 },
  reachPx: REACH_PX,
  clearancePx: CLEARANCE_PX,
}

/** A heading well off any fixture koi's course, so a caret riding it is unmistakably a decision. */
const OFF_COURSE = 1.9

/** One decision of every shape a koi can report, so no mark can be read against only part of the vocabulary. */
const INTENTS: readonly [string, KoiIntent][] = [
  ['travel', TRAVELLING],
  ['avoid', { ...TRAVELLING, kind: 'avoid', target: { x: 200, y: 700 } }],
  ['a pass above', { ...TRAVELLING, kind: 'depth-change', target: null, direction: 'above' }],
  ['a pass below', { ...TRAVELLING, kind: 'depth-change', target: null, direction: 'below' }],
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
 * How far a point sits off the nearest segment of a reported chain.
 *
 * @param point - The point in pond space.
 * @param spine - The reported spine samples, nose first.
 * @returns The distance in pond pixels.
 */
function offChain(point: Vec2, spine: readonly Vec2[]): number {
  let nearest = Infinity
  for (const [index, sample] of spine.slice(1).entries()) {
    const from = spine[index] ?? sample
    const dx = sample.x - from.x
    const dy = sample.y - from.y
    const span = dx * dx + dy * dy
    const along = span === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / span))
    nearest = Math.min(nearest, Math.hypot(point.x - (from.x + dx * along), point.y - (from.y + dy * along)))
  }
  return nearest
}

/**
 * How far along a koi's heading a drawn point sits from a pond-space origin.
 *
 * @param point - The point in overlay pixels.
 * @param outline - The koi that was drawn.
 * @param from - The pond-space origin to measure from; its nose by default.
 * @returns The distance along the heading, in pixels.
 */
function alongOf(point: Vec2 | undefined, outline: KoiOutline, from: Vec2 = sampleAt(outline, 0)): number {
  return (
    ((point?.x ?? 0) - (from.x - VIEW.x)) * Math.cos(outline.heading) + ((point?.y ?? 0) - (from.y - VIEW.y)) * Math.sin(outline.heading)
  )
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

  it('pulls the anchor its share of the reported body back along the spine', () => {
    const outline = swum(0)
    const nose = sampleAt(outline, 0)
    const back = spineLength(outline.spine) * HEAD_CENTRE_ALONG
    expect(Math.hypot(anchorOf(outline).x - nose.x, anchorOf(outline).y - nose.y)).toBeCloseTo(back, 9)
  })

  it.each(POSES)('sets the anchor on the reported chain itself through %s', (_pose, turnRate) => {
    // why: Walking the chain rather than projecting along the heading is what keeps the anchor on the body a bending koi actually reported, whatever its build.
    expect(offChain(anchorOf(swum(turnRate)), swum(turnRate).spine)).toBeLessThan(1e-9)
  })

  it('parts from a straight-heading projection once the body is bending', () => {
    const outline = swum(1.1)
    const nose = sampleAt(outline, 0)
    const back = spineLength(outline.spine) * HEAD_CENTRE_ALONG
    const projected = { x: nose.x - Math.cos(outline.heading) * back, y: nose.y - Math.sin(outline.heading) * back }
    const anchor = anchorOf(outline)
    expect(Math.hypot(anchor.x - projected.x, anchor.y - projected.y)).toBeGreaterThan(1)
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

describe('beamOf', () => {
  it('reads the widest half-width a koi reported', () => {
    const reported = sampleSpine(spineGirth(BODY_PX, GIRTH_RATIO), 5)
    expect(beamOf(reported)).toBe(Math.max(...reported))
    // how: The samples land either side of the beam rather than on it, so the widest reported half-width is a shade under the koi's true one and never over it.
    expect(beamOf(reported) / (BODY_PX * GIRTH_RATIO)).toBeGreaterThan(0.95)
  })

  it('reads nothing from a koi that reported no body', () => {
    expect(beamOf([])).toBe(0)
  })
})

describe('the painted field', () => {
  it('draws the very region the koi said it is watching', () => {
    const outline = swum(0)
    const corners = painted(outline).shells()[0]?.points ?? []
    const across = Math.hypot((corners[0]?.x ?? 0) - (corners[3]?.x ?? 0), (corners[0]?.y ?? 0) - (corners[3]?.y ?? 0))
    // why: The band is the koi's own reported clearance across and it stops at the koi's own reported reach; every number in it came off the wire rather than out of this painter.
    expect(across).toBeCloseTo(CLEARANCE_PX * 2, 6)
    expect(alongOf(corners[1], outline)).toBeCloseTo(REACH_PX, 6)
  })

  it.each(POSES)('opens the field ahead of the nose it hangs from through %s', (_pose, turnRate) => {
    const outline = swum(turnRate)
    const opened = Math.min(
      ...painted(outline)
        .shells()
        .flatMap((shell) => shell.points.map((point) => alongOf(point, outline)))
    )
    // why: A koi's whole body lies behind the point it judges a crossing from, so a band that opens ahead of that point cannot be laid over the animal at any build; the standoff is only what keeps the ink off the snout itself.
    expect(opened).toBeGreaterThan(0)
    expect(opened).toBeCloseTo(spineLength(outline.spine) * FIELD_STANDOFF_BODIES, 6)
  })

  it.each(POSES)('lays no part of the field behind the nose through %s', (_pose, turnRate) => {
    const outline = swum(turnRate)
    const behind = painted(outline)
      .shells()
      .flatMap((shell) => shell.points)
      .filter((point) => alongOf(point, outline) <= 0)
    expect(behind).toEqual([])
  })

  it('narrows every shell in toward the middle of the band', () => {
    const widths = painted(swum(0))
      .shells()
      .map((shell) =>
        Math.hypot((shell.points[0]?.x ?? 0) - (shell.points[3]?.x ?? 0), (shell.points[0]?.y ?? 0) - (shell.points[3]?.y ?? 0))
      )
    expect(widths).toEqual([...widths].sort((first, second) => second - first))
    expect(new Set(widths).size).toBe(widths.length)
  })

  it('runs its ink out entirely at the standoff and at the horizon', () => {
    const stops = painted(swum(0)).stops
    expect(stops[0]).toEqual({ at: 0, color: 'rgba(255, 255, 255, 0)' })
    expect(stops[1]?.color).toBe('rgba(255, 255, 255, 0)')
    expect(stops[stops.length - 1]).toEqual({ at: 1, color: 'rgba(255, 255, 255, 0)' })
  })

  it('draws nothing ahead of a koi anticipating no further than its own head', () => {
    expect(painted(swum(0, { ...TRAVELLING, reachPx: 1 })).shells()).toEqual([])
  })

  it.each(INTENTS)('draws the field in one ink whatever a koi decided, here %s', (_kind, intent) => {
    const inks = painted(swum(0, intent)).stops.map((stop) => stop.color.slice(0, stop.color.lastIndexOf(',')))
    expect([...new Set(inks)]).toEqual(['rgba(255, 255, 255'])
  })

  it('leaves no outline around the field', () => {
    // how: The caret is the only stroke the overlay lays, so a second one could only be an edge drawn around the fill.
    expect(painted(swum(0)).strokes).toHaveLength(1)
  })

  it('draws nothing for a held koi', () => {
    const overlay = painted({ ...swum(0), intent: undefined })
    expect([overlay.shells().length, overlay.strokes.length]).toEqual([0, 0])
  })

  it('draws nothing for a koi reporting no body', () => {
    const overlay = painted({ ...swum(0), spine: [], girth: [] })
    expect([overlay.shells().length, overlay.strokes.length]).toEqual([0, 0])
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
    const outline = swum(0, { ...TRAVELLING, heading: OFF_COURSE })
    expect(caretAngle(painted(outline).strokes, outline)).toBeCloseTo(OFF_COURSE, 9)
  })

  it('rides the heading the koi reported rather than a bearing worked out about it', () => {
    // why: The koi hands over the very term its own integrator steers by, so the mark cannot describe a manoeuvre the animal is not making, and the host never re-derives one.
    const outline = swum(0, { ...TRAVELLING, heading: OFF_COURSE, target: { x: 0, y: 0 } })
    expect(caretAngle(painted(outline).strokes, outline)).toBeCloseTo(OFF_COURSE, 9)
  })

  it('fills its core once a koi has committed to an avoidance, and not before', () => {
    const filled = INTENTS.map(([, intent]) => painted(swum(0, intent)).cores().length)
    expect(filled).toEqual([0, 1, 1, 1])
  })

  it('weighs the mark by how hard the koi is committed to it', () => {
    const alphaOf = (gain: number): number => {
      const ink = painted(swum(0, { ...TRAVELLING, gain })).strokes[0]?.ink ?? ''
      return Number(ink.slice(ink.lastIndexOf(' ') + 1, -1))
    }
    // why: A koi drifting onto its next waypoint has decided nothing worth announcing; one that has committed its helm has, and the difference is the whole reading.
    expect(alphaOf(0.12)).toBeLessThan(alphaOf(1))
    expect(alphaOf(1)).toBe(alphaOf(1.6))
  })

  it('sizes and orbits the mark from the body that reported it', () => {
    const reach = (body: number): number => {
      const outline = {
        ...swum(0),
        spine: sampleSpine(createSpine({ x: 600, y: 400 }, 0, body).joints, 5),
        girth: sampleSpine(spineGirth(body, GIRTH_RATIO), 5),
      }
      return alongOf(painted(outline).strokes[0]?.points[1], outline)
    }
    // why: A pond scales its koi to the water it was given, so a mark measured in pixels would crowd a large koi and be lost on a small one.
    expect(reach(BODY_PX * 2)).toBeGreaterThan(reach(BODY_PX) * 1.8)
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
    const decided = swum(0, { ...TRAVELLING, kind: 'avoid', heading: OFF_COURSE })
    painter.paint(frameOf(swum(0)))
    painter.clear()
    painter.paint(frameOf(decided))
    expect(caretAngle(overlay.strokes, decided)).toBeCloseTo(OFF_COURSE, 9)
  })
})
