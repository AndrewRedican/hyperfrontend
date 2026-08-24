/**
 * The overlay canvas the painter's specs draw on, and how they read it back.
 *
 * The environment carries no 2D backend, and none is wanted: what these specs
 * ask about is where the painter drew and in what ink, and both of those are
 * arguments rather than pixels. Everything the painter is handed and everything
 * it lays down passes through here, so a spec states what it expects of a mark
 * rather than how to fish that mark out of a call log.
 */
import type { KoiOutline, Vec2 } from '@hyperfrontend/demo-koi-lib'
import type { InteractionsFrame } from '../interactions'
import { createInteractionsPainter, headCentre } from '../interactions'

/** The visible window the overlay paints, so a spec reading a coordinate proves the offset came off it. */
export const VIEW: Vec2 = { x: 40, y: 25 }

/** The frame step every painted frame is handed, in seconds. */
export const STEP_S = 1 / 60

/** How wide every painted frame is, in CSS pixels. */
export const FRAME_WIDTH = 800

/** How tall every painted frame is, in CSS pixels. */
export const FRAME_HEIGHT = 600

/** One shape the painter filled, with the state that was in force when it went down. */
export interface FillRecord {
  /** Arc centre x in overlay pixels, or the origin when the shape carried no arc. */
  x: number
  /** Arc centre y in overlay pixels. */
  y: number
  /** The arc's radius in overlay pixels, along whatever direction the transform's own x axis points. */
  radius: number
  /** The arc's radius across that axis; equal to `radius` unless the shape was laid under a scale. */
  radiusAcross: number
  /** Which way the transform's x axis pointed when the shape went down, in radians. */
  facing: number
  /** Where the arc starts, in radians. */
  from: number
  /** Where the arc ends, in radians. */
  to: number
  /** Whether an arc went into the shape. */
  arc: boolean
  /** The straight points the shape ran through, in overlay pixels. */
  points: readonly Vec2[]
  /** The alpha the fill was laid at. */
  alpha: number
  /** The flat colour the fill was laid in, or the empty string when a gradient was. */
  ink: string
  /** Whether a gradient was in the fill style, as against a flat colour. */
  gradient: boolean
}

/** One stroke the painter laid, with the ink it went down in. */
export interface StrokeRecord {
  /** The ink the stroke was laid in. */
  ink: string
  /** The points the stroke ran through, in overlay pixels. */
  points: readonly Vec2[]
}

/**
 * An overlay canvas that remembers what a painter did to it.
 *
 * @returns The stand-in canvas and the record of the calls made against it.
 *
 * @example Reading back the pearls one frame laid
 * ```typescript
 * const overlay = recordingOverlay()
 * createInteractionsPainter(overlay.canvas).paint(frameOf(outline))
 * expect(overlay.pearls()).toHaveLength(10)
 * ```
 */
export function recordingOverlay() {
  const fills: FillRecord[] = []
  const strokes: StrokeRecord[] = []
  const stops: { at: number; color: string }[] = []
  const wipes: { width: number; height: number }[] = []
  let path: Vec2[] = []
  let pending = { x: 0, y: 0, radius: 0, radiusAcross: 0, facing: 0, from: 0, to: 0, arc: false }
  let fillStyle: unknown = ''
  let strokeStyle = ''
  let alpha = 1
  // why: The painter draws the perception field in the koi's own frame rather than in overlay pixels, so a spec that read the raw arguments back would be reading a unit circle. The matrix in force is carried here and every recorded coordinate is mapped through it, which keeps every spec stated in the pixels a visitor actually sees.
  let matrix = [1, 0, 0, 1, 0, 0]
  const stack: number[][] = []

  /** The point a pair of local coordinates lands on, in overlay pixels. */
  const mapped = (x: number, y: number): Vec2 => ({
    x: (matrix[0] ?? 1) * x + (matrix[2] ?? 0) * y + (matrix[4] ?? 0),
    y: (matrix[1] ?? 0) * x + (matrix[3] ?? 1) * y + (matrix[5] ?? 0),
  })

  /** Lays a transform under whatever is already in force, the way a canvas composes them. */
  const compose = (a: number, b: number, c: number, d: number, e: number, f: number): void => {
    const [m0 = 1, m1 = 0, m2 = 0, m3 = 1, m4 = 0, m5 = 0] = matrix
    matrix = [m0 * a + m2 * b, m1 * a + m3 * b, m0 * c + m2 * d, m1 * c + m3 * d, m0 * e + m2 * f + m4, m1 * e + m3 * f + m5]
  }

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
    setTransform: (a = 1, b = 0, c = 0, d = 1, e = 0, f = 0): void => {
      matrix = [a, b, c, d, e, f]
    },
    save: (): void => {
      stack.push([...matrix])
    },
    restore: (): void => {
      matrix = stack.pop() ?? [1, 0, 0, 1, 0, 0]
    },
    translate: (x: number, y: number): void => compose(1, 0, 0, 1, x, y),
    rotate: (angle: number): void => compose(Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0),
    scale: (x: number, y: number): void => compose(x, 0, 0, y, 0, 0),
    clearRect: (_x: number, _y: number, width: number, height: number): void => {
      wipes.push({ width, height })
    },
    beginPath: (): void => {
      path = []
      pending = { x: 0, y: 0, radius: 0, radiusAcross: 0, facing: 0, from: 0, to: 0, arc: false }
    },
    closePath: (): void => undefined,
    moveTo: (x: number, y: number): void => {
      path.push(mapped(x, y))
    },
    lineTo: (x: number, y: number): void => {
      path.push(mapped(x, y))
    },
    createLinearGradient: () => ({
      addColorStop: (at: number, color: string): void => {
        stops.push({ at, color })
      },
    }),
    createRadialGradient: () => ({
      addColorStop: (at: number, color: string): void => {
        stops.push({ at, color })
      },
    }),
    arc: (x: number, y: number, radius: number, from: number, to: number): void => {
      const centre = mapped(x, y)
      const along = mapped(x + radius, y)
      const across = mapped(x, y + radius)
      pending = {
        ...centre,
        radius: Math.hypot(along.x - centre.x, along.y - centre.y),
        radiusAcross: Math.hypot(across.x - centre.x, across.y - centre.y),
        facing: Math.atan2(along.y - centre.y, along.x - centre.x),
        from,
        to,
        arc: true,
      }
    },
    fill: (): void => {
      fills.push({
        ...pending,
        points: path,
        alpha,
        ink: typeof fillStyle === 'string' ? fillStyle : '',
        gradient: typeof fillStyle !== 'string',
      })
    },
    stroke: (): void => {
      strokes.push({ ink: strokeStyle, points: path })
    },
  }

  const canvas = { width: 0, height: 0, style: { width: '', height: '' }, getContext: () => context }

  return {
    canvas: <HTMLCanvasElement>(<unknown>canvas),
    // how: The field is the only thing the overlay fills with a gradient, and it lays exactly one per koi.
    fields: (): FillRecord[] => fills.filter((fill) => fill.gradient),
    // how: A pearl is the only flat fill the overlay lays around an arc; the field is a gradient and a caret's core is a straight-sided shape.
    pearls: (): FillRecord[] => fills.filter((fill) => !fill.gradient && fill.arc),
    // how: What is left is a caret core, filled only by a koi that has committed to an avoidance.
    cores: (): FillRecord[] => fills.filter((fill) => !fill.gradient && !fill.arc),
    strokes,
    stops,
    wipes,
  }
}

/**
 * One overlay frame over a single koi.
 *
 * @param outline - The koi to annotate.
 * @returns The frame the painter is handed.
 */
export function frameOf(outline: KoiOutline): InteractionsFrame {
  return { width: FRAME_WIDTH, height: FRAME_HEIGHT, view: VIEW, pixelRatio: 1, dt: STEP_S, shoal: [{ id: 'vanilla:0', outline }] }
}

/**
 * Paints one overlay frame over a single koi.
 *
 * @param outline - The koi to annotate.
 * @returns The record of what the painter drew.
 */
export function painted(outline: KoiOutline) {
  const overlay = recordingOverlay()
  createInteractionsPainter(overlay.canvas).paint(frameOf(outline))
  return overlay
}

/**
 * The anchor an outline resolves to, refusing an outline without one.
 *
 * @param outline - The koi's reported outline.
 * @returns The anchor in pond space.
 */
export function anchorOf(outline: KoiOutline): Vec2 {
  const anchor = headCentre(outline)
  if (anchor === null) {
    throw new Error('the fixture outline reported no body')
  }
  return anchor
}

/**
 * The angle the last caret a painter laid is riding at.
 *
 * @param strokes - Every stroke the painter has laid.
 * @param outline - The koi whose caret to read, which is what the angle is measured from.
 * @returns The angle in radians.
 */
export function caretAngle(strokes: readonly StrokeRecord[], outline: KoiOutline): number {
  const apex = strokes[strokes.length - 1]?.points[1]
  if (apex === undefined) {
    throw new Error('the painter laid no caret')
  }
  const head = anchorOf(outline)
  return Math.atan2(apex.y - (head.y - VIEW.y), apex.x - (head.x - VIEW.x))
}
