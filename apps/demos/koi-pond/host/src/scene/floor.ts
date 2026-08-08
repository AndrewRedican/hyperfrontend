/**
 * The pond bed.
 *
 * Painted once per resize rather than per frame: the bed is still water and
 * still stone, and repainting it sixty times a second would be the single most
 * expensive thing in a scene that already carries seven compositing layers.
 * What moves — the caustic light, the ripples — lives on the surface canvas
 * above the koi.
 *
 * Every stone is placed from `randomPseudo` against a fixed seed, so the bed a
 * visitor sees is the same bed after a resize, and the same bed on every
 * machine.
 */
import { randomPseudo } from '@hyperfrontend/random-generator-utils'

/** Seed the bed is laid out from; changing it lays a different pond. */
const BED_SEED = 20_260_806

/** How many stones settle on the bed per million square pixels. */
const STONE_DENSITY = 26

/** Most stones the bed will ever carry, so a huge viewport cannot unbound the paint. */
const MAX_STONES = 220

/** A stone resting on the pond bed. */
interface Stone {
  /** Centre x in CSS pixels. */
  x: number
  /** Centre y in CSS pixels. */
  y: number
  /** Radius in CSS pixels. */
  radius: number
  /** How much it is stretched along its long axis. */
  stretch: number
  /** Its long axis, in radians. */
  angle: number
  /** How light the stone reads against the bed, 0 to 1. */
  tone: number
}

/**
 * Lays out the stones for a bed of a given size.
 *
 * @param width - Bed width in CSS pixels.
 * @param height - Bed height in CSS pixels.
 * @returns The stones, deterministic for a given size.
 */
export function layStones(width: number, height: number): Stone[] {
  const area = (width * height) / 1_000_000
  const count = Math.min(MAX_STONES, Math.round(area * STONE_DENSITY))
  const shorter = Math.min(width, height)
  return Array.from({ length: count }, (_unused, index) => {
    const seed = BED_SEED + index * 13
    return {
      x: randomPseudo(seed) * width,
      y: randomPseudo(seed + 1) * height,
      // magic: Stones between 0.35% and 1.25% of the shorter axis read as bed gravel; anything larger starts reading as a boulder floating in the water.
      radius: shorter * (0.0035 + randomPseudo(seed + 2) * 0.009),
      stretch: 1 + randomPseudo(seed + 3) * 0.8,
      angle: randomPseudo(seed + 4) * Math.PI,
      tone: randomPseudo(seed + 5),
    }
  })
}

/**
 * Paints the pond bed onto a canvas.
 *
 * @param canvas - The floor canvas.
 * @param width - Bed width in CSS pixels.
 * @param height - Bed height in CSS pixels.
 * @param pixelRatio - Device pixel ratio to render at.
 */
export function paintFloor(canvas: HTMLCanvasElement, width: number, height: number, pixelRatio: number): void {
  const context = canvas.getContext('2d')
  if (context === null || width === 0 || height === 0) {
    return
  }
  canvas.width = Math.round(width * pixelRatio)
  canvas.height = Math.round(height * pixelRatio)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)

  // how: A wide radial gradient reads as depth — the middle of the pond falls away, the edges shelve up toward the bank.
  const water = context.createRadialGradient(width * 0.5, height * 0.46, 0, width * 0.5, height * 0.5, Math.max(width, height) * 0.78)
  water.addColorStop(0, '#20423a')
  water.addColorStop(0.55, '#16302c')
  water.addColorStop(1, '#0b1c1b')
  context.fillStyle = water
  context.fillRect(0, 0, width, height)

  for (const stone of layStones(width, height)) {
    context.save()
    context.translate(stone.x, stone.y)
    context.rotate(stone.angle)
    context.scale(stone.stretch, 1)

    // why: A tight, low-contrast shadow reads as a stone settled into silt; a wide dark halo reads as one floating above it.
    context.beginPath()
    context.arc(0, stone.radius * 0.16, stone.radius * 1.06, 0, Math.PI * 2)
    context.fillStyle = 'rgba(4, 14, 14, 0.2)'
    context.fill()

    const lit = context.createRadialGradient(-stone.radius * 0.22, -stone.radius * 0.26, stone.radius * 0.15, 0, 0, stone.radius)
    // magic: A narrow lightness band keeps the gravel sitting behind the koi instead of competing with them.
    const lightness = 24 + stone.tone * 12
    lit.addColorStop(0, `hsl(168 10% ${lightness + 5}%)`)
    lit.addColorStop(1, `hsl(172 12% ${lightness - 4}%)`)
    context.beginPath()
    context.arc(0, 0, stone.radius, 0, Math.PI * 2)
    context.fillStyle = lit
    context.fill()
    context.restore()
  }

  // why: A vignette pulls the eye to the middle of the pond and hides the bed's edge where the frame cuts it.
  const vignette = context.createRadialGradient(
    width * 0.5,
    height * 0.5,
    Math.min(width, height) * 0.3,
    width * 0.5,
    height * 0.5,
    Math.max(width, height) * 0.75
  )
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
  vignette.addColorStop(1, 'rgba(2, 10, 10, 0.55)')
  context.fillStyle = vignette
  context.fillRect(0, 0, width, height)
}
