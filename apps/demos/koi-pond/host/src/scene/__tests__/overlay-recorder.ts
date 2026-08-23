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
  /** The arc's radius in overlay pixels. */
  radius: number
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
  let pending = { x: 0, y: 0, radius: 0, from: 0, to: 0, arc: false }
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
    clearRect: (_x: number, _y: number, width: number, height: number): void => {
      wipes.push({ width, height })
    },
    beginPath: (): void => {
      path = []
      pending = { x: 0, y: 0, radius: 0, from: 0, to: 0, arc: false }
    },
    closePath: (): void => undefined,
    moveTo: (x: number, y: number): void => {
      path.push({ x, y })
    },
    lineTo: (x: number, y: number): void => {
      path.push({ x, y })
    },
    createLinearGradient: () => ({
      addColorStop: (at: number, color: string): void => {
        stops.push({ at, color })
      },
    }),
    arc: (x: number, y: number, radius: number, from: number, to: number): void => {
      pending = { x, y, radius, from, to, arc: true }
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
    // how: The field is the only thing the overlay fills with a gradient, so its shells sort themselves out of the way.
    shells: (): FillRecord[] => fills.filter((fill) => fill.gradient),
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
