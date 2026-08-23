import type { KoiIntent, KoiOutline, KoiPhase, Vec2 } from '@hyperfrontend/demo-koi-lib'
import { describe, expect, it } from 'vitest'
import { advanceSpine, createSpine, outlineContains, sampleSpine, spineGirth } from '@hyperfrontend/demo-koi-lib'
import { CONE_HALF_RAD, CONE_WEDGES, HEAD_CENTRE_ALONG, createInteractionsPainter, headCentre, spineLength } from '../interactions'

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

/** The visible window the overlay paints, so a spec reading coordinates proves the offset came off them. */
const VIEW = { x: 40, y: 25 }

/** Which spine sample the fixtures read as the middle of the body. */
const BODY_CENTRE_SAMPLE = 2

/** The three poses the anchor has to survive, and how fast the heading winds through each. */
const POSES: readonly [string, number][] = [
  ['a straight run', 0],
  ['a mid-turn', 0.45],
  ['a hard turn', 1.1],
]

/** The travel decision every fixture koi reports unless a spec asks for another. */
const TRAVELLING: KoiIntent = { kind: 'travel', target: { x: 900, y: 400 }, reachPx: REACH_PX }

/** One decision of each family, so the cone can be read against everything a koi reports. */
const INTENTS: readonly [string, KoiIntent][] = [
  ['travel', TRAVELLING],
  ['avoid', { kind: 'avoid', target: { x: 200, y: 700 }, reachPx: REACH_PX }],
  ['depth-change', { kind: 'depth-change', target: null, direction: 'above', reachPx: REACH_PX }],
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
 * The anchor an outline resolves to, refusing an outline without one.
 *
 * @param outline - The koi's reported outline.
 * @returns The anchor in pond space.
 */
function anchorOf(outline: KoiOutline): Vec2 {
  const anchor = headCentre(outline)
  if (anchor === null) {
    throw new Error('the fixture outline reported no body')
  }
  return anchor
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

/** One arc the painter filled, with the state that was in force when it went down. */
interface FillRecord {
  /** Arc centre x in overlay pixels. */
  x: number
  /** Arc centre y in overlay pixels. */
  y: number
  /** Where the arc starts, in radians. */
  from: number
  /** Where the arc ends, in radians. */
  to: number
  /** The alpha the fill was laid at. */
  alpha: number
  /** Whether a gradient was in the fill style, as against a flat colour. */
  gradient: boolean
}

/**
 * An overlay canvas that remembers what a painter did to it.
 *
 * The environment carries no 2D backend, and none is wanted: what these specs
 * ask about is where the painter drew and in what ink, and both of those are
 * arguments rather than pixels.
 *
 * @returns The stand-in canvas and the record of the calls made against it.
 */
function recordingOverlay() {
  const fills: FillRecord[] = []
  const strokes: string[] = []
  const stops: { at: number; color: string }[] = []
  let pending = { x: 0, y: 0, from: 0, to: 0 }
  let fillStyle: unknown = ''
  let strokeStyle = ''
  let alpha = 1

  const context = {
    lineWidth: 1,
    set fillStyle(value: unknown) {
      fillStyle = value
    },
    set strokeStyle(value: string) {
      strokeStyle = value
    },
    set globalAlpha(value: number) {
      alpha = value
    },
    setTransform: (): void => undefined,
    clearRect: (): void => undefined,
    beginPath: (): void => undefined,
    closePath: (): void => undefined,
    moveTo: (): void => undefined,
    lineTo: (): void => undefined,
    setLineDash: (): void => undefined,
    createRadialGradient: () => ({
      addColorStop: (at: number, color: string): void => {
        stops.push({ at, color })
      },
    }),
    arc: (x: number, y: number, _radius: number, from: number, to: number): void => {
      pending = { x, y, from, to }
    },
    fill: (): void => {
      fills.push({ ...pending, alpha, gradient: typeof fillStyle !== 'string' })
    },
    stroke: (): void => {
      strokes.push(strokeStyle)
    },
  }

  const canvas = { width: 0, height: 0, style: { width: '', height: '' }, getContext: () => context }

  return {
    canvas: <HTMLCanvasElement>(<unknown>canvas),
    // how: The cone is the only thing filled with a gradient, so the flat-coloured waypoint dot sorts itself out of the way.
    wedges: (): FillRecord[] => fills.filter((fill) => fill.gradient),
    strokes,
    stops,
  }
}

/**
 * Paints one overlay frame over a single koi.
 *
 * @param outline - The koi to annotate.
 * @returns The record of what the painter drew.
 */
function painted(outline: KoiOutline) {
  const overlay = recordingOverlay()
  createInteractionsPainter(overlay.canvas).paint({ width: 800, height: 600, view: VIEW, pixelRatio: 1, outlines: [outline] })
  return overlay
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
    expect(painted(swum(0)).strokes).toEqual(['rgba(74, 222, 128, 0.85)'])
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
