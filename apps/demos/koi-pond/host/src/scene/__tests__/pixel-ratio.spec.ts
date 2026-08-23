import { describe, expect, it } from 'vitest'
import { paintFloor } from '../floor'
import { createInteractionsPainter } from '../interactions'
import { MAX_CANVAS_DPR, canvasPixelRatio } from '../pixel-ratio'
import { createRippleField } from '../ripples'
import { createSurfacePainter } from '../surface-canvas'

/** What a high-density phone reports. */
const PHONE_DPR = 2.8125

/** A ratio a laptop reports, comfortably under the ceiling. */
const LAPTOP_DPR = 1.5

/** The CSS size of the gallery card the pond paints into. */
const CARD_PX = 288

/** The backing store a card fills at the ceiling. */
const CAPPED_PX = CARD_PX * MAX_CANVAS_DPR

/** The backing store a card fills at the laptop's ratio. */
const LAPTOP_PX = CARD_PX * LAPTOP_DPR

/**
 * A canvas that records what a painter sizes it to.
 *
 * The real thing needs a native 2D backend the test environment does not
 * carry, and every drawing call here is beside the point: what the cap is
 * about is the backing store, so the stub remembers each width it is given and
 * accepts everything else.
 *
 * @returns The stand-in canvas and what the painter did to it.
 */
function stubCanvas() {
  const widths: number[] = []
  const transforms: number[][] = []
  const style = { width: '', height: '' }
  let width = 0
  let height = 0

  const noop = (): undefined => undefined
  const gradient = () => ({ addColorStop: noop })
  const recorded: Record<string, unknown> = {
    setTransform: (...values: number[]) => {
      transforms.push(values)
    },
  }
  const context = new Proxy(recorded, {
    get: (target, key) => {
      const known = target[<string>key]
      if (known !== undefined) {
        return known
      }
      // how: A gradient is the one call whose return value the painters go on to use; everything else is a stroke into the void.
      return String(key).startsWith('create') ? gradient : noop
    },
  })

  const canvas = {
    get width() {
      return width
    },
    set width(value: number) {
      width = value
      widths.push(value)
    },
    get height() {
      return height
    },
    set height(value: number) {
      height = value
    },
    style,
    getContext: () => context,
  }

  return { canvas: <HTMLCanvasElement>(<unknown>canvas), widths, transforms, style, size: () => ({ width, height }) }
}

/**
 * One overlay frame over an empty shoal.
 *
 * @param pixelRatio - What the device reports.
 * @returns The frame to paint.
 */
function overlayFrame(pixelRatio: number) {
  return { width: CARD_PX, height: CARD_PX, view: { x: 0, y: 0 }, pixelRatio, shoal: [] }
}

/**
 * One frame of still surface water.
 *
 * @param pixelRatio - What the device reports.
 * @returns The frame to paint.
 */
function waterFrame(pixelRatio: number) {
  return {
    width: CARD_PX,
    height: CARD_PX,
    view: { x: 0, y: 0 },
    pixelRatio,
    fishLength: 130,
    elapsedMs: 0,
    reducedMotion: false,
    fade: 0,
    field: createRippleField(),
  }
}

describe('canvasPixelRatio', () => {
  it('holds a phone-class ratio at the ceiling', () => {
    expect(canvasPixelRatio(PHONE_DPR)).toBe(MAX_CANVAS_DPR)
  })

  it('leaves a ratio under the ceiling alone', () => {
    expect(canvasPixelRatio(LAPTOP_DPR)).toBe(LAPTOP_DPR)
  })
})

describe('the pond bed', () => {
  it('sizes its backing store at the ceiling on a phone-class display', () => {
    const bed = stubCanvas()
    paintFloor(bed.canvas, CARD_PX, CARD_PX, PHONE_DPR)
    expect(bed.size()).toEqual({ width: CAPPED_PX, height: CAPPED_PX })
  })

  it('scales its drawing transform to the capped ratio', () => {
    const bed = stubCanvas()
    paintFloor(bed.canvas, CARD_PX, CARD_PX, PHONE_DPR)
    expect(bed.transforms[0]).toEqual([MAX_CANVAS_DPR, 0, 0, MAX_CANVAS_DPR, 0, 0])
  })

  it('paints at the reported ratio when it is under the ceiling', () => {
    const bed = stubCanvas()
    paintFloor(bed.canvas, CARD_PX, CARD_PX, LAPTOP_DPR)
    expect(bed.size()).toEqual({ width: LAPTOP_PX, height: LAPTOP_PX })
  })

  it('keeps the CSS size the frame asked for', () => {
    const bed = stubCanvas()
    paintFloor(bed.canvas, CARD_PX, CARD_PX, PHONE_DPR)
    expect(bed.style).toEqual({ width: `${CARD_PX}px`, height: `${CARD_PX}px` })
  })

  it('re-derives the backing store when a remeasure brings a new ratio', () => {
    const bed = stubCanvas()
    paintFloor(bed.canvas, CARD_PX, CARD_PX, PHONE_DPR)
    paintFloor(bed.canvas, CARD_PX, CARD_PX, LAPTOP_DPR)
    expect(bed.widths).toEqual([CAPPED_PX, LAPTOP_PX])
  })
})

describe('the interactions overlay', () => {
  it('sizes its backing store at the ceiling on a phone-class display', () => {
    const overlay = stubCanvas()
    createInteractionsPainter(overlay.canvas).paint(overlayFrame(PHONE_DPR))
    expect(overlay.size()).toEqual({ width: CAPPED_PX, height: CAPPED_PX })
  })

  it('scales its drawing transform to the capped ratio', () => {
    const overlay = stubCanvas()
    createInteractionsPainter(overlay.canvas).paint(overlayFrame(PHONE_DPR))
    expect(overlay.transforms[0]).toEqual([MAX_CANVAS_DPR, 0, 0, MAX_CANVAS_DPR, 0, 0])
  })

  it('paints at the reported ratio when it is under the ceiling', () => {
    const overlay = stubCanvas()
    createInteractionsPainter(overlay.canvas).paint(overlayFrame(LAPTOP_DPR))
    expect(overlay.size()).toEqual({ width: LAPTOP_PX, height: LAPTOP_PX })
  })

  it('leaves the backing store alone when a reported ratio above the ceiling changes', () => {
    const overlay = stubCanvas()
    const painter = createInteractionsPainter(overlay.canvas)
    painter.paint(overlayFrame(PHONE_DPR))
    painter.paint(overlayFrame(3))
    expect(overlay.widths).toEqual([CAPPED_PX])
  })

  it('re-derives the backing store when the ratio drops under the ceiling', () => {
    const overlay = stubCanvas()
    const painter = createInteractionsPainter(overlay.canvas)
    painter.paint(overlayFrame(PHONE_DPR))
    painter.paint(overlayFrame(LAPTOP_DPR))
    expect(overlay.widths).toEqual([CAPPED_PX, LAPTOP_PX])
  })
})

describe('the surface water', () => {
  it('sizes its backing store at the ceiling on a phone-class display', () => {
    const water = stubCanvas()
    createSurfacePainter(water.canvas).paint(waterFrame(PHONE_DPR))
    expect(water.size()).toEqual({ width: CAPPED_PX, height: CAPPED_PX })
  })

  it('paints at the reported ratio when it is under the ceiling', () => {
    const water = stubCanvas()
    createSurfacePainter(water.canvas).paint(waterFrame(LAPTOP_DPR))
    expect(water.size()).toEqual({ width: LAPTOP_PX, height: LAPTOP_PX })
  })
})
