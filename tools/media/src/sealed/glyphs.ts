import { imul } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** How many placeholder dots a message card carries. */
export const CARD_DOTS = 4

/** A key, as the renderer describes one. */
export interface KeyGlyph {
  /** Horizontal centre of the whole key. */
  cx: number
  /** Vertical centre of the shaft. */
  cy: number
  /** Length from the far side of the bow to the tip. */
  length: number
  /** Which way the tip points: 1 for right, -1 for left. */
  direction: number
  /** What the key is drawn in. */
  colour: string
  /** Whether the bow is a ring rather than a disc, for the public material a hello carries. */
  hollow: boolean
  /** What the hole in a solid bow is drawn in; ignored for a hollow key. */
  hole: string
}

/**
 * A number in [-1, 1] that depends on nothing but its two arguments.
 *
 * The scramble a card goes through has to look unsettled and has to be the
 * same on every machine and every run, so it is hashed rather than drawn.
 *
 * @param index - Which dot.
 * @param step - Which moment of the scramble.
 * @returns A value from -1 to 1.
 * @example The first dot's offset at the second step
 * ```ts
 * jitter(0, 1)
 * ```
 */
export function jitter(index: number, step: number): number {
  // magic: the odd multiplier and shift widths of a murmur3 finaliser, which is what makes one changed input bit move every output bit
  let hash = imul((index + 1) * 0x9e3779b1 + (step + 1) * 0x85ebca77, 0xc2b2ae35)
  hash ^= hash >>> 15
  hash = imul(hash, 0x27d4eb2f)
  hash ^= hash >>> 13
  return ((hash >>> 0) / 0x100000000) * 2 - 1
}

/**
 * One corner of a rounded rectangle path: an arc when it has a radius, a straight line when it has none.
 *
 * @param radius - How far the corner is rounded, in pixels; zero for a square corner.
 * @param x - Where the corner ends.
 * @param y - Where the corner ends.
 * @returns A path command.
 */
function corner(radius: number, x: number, y: number): string {
  return radius > 0 ? `A ${radius} ${radius} 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}` : `L ${x.toFixed(1)} ${y.toFixed(1)}`
}

/**
 * The path of a rectangle whose left and right corners are rounded by different radii.
 *
 * A frame is three pieces butted together, and each piece is rounded only on
 * the side that faces outward, so the header, the body and the tag read as
 * one capsule once they meet and as separate parts while they are apart.
 *
 * @param x - Left edge.
 * @param y - Top edge.
 * @param width - How wide the rectangle is, in pixels.
 * @param height - How tall the rectangle is, in pixels.
 * @param left - Radius of both left corners.
 * @param right - Radius of both right corners.
 * @returns The `d` attribute of the path.
 * @example A header strip, rounded on its outer side only
 * ```ts
 * cornerRect(160, 111, 20, 22, 5, 0)
 * ```
 */
export function cornerRect(x: number, y: number, width: number, height: number, left: number, right: number): string {
  const r = x + width
  const b = y + height
  return [
    `M ${(x + left).toFixed(1)} ${y.toFixed(1)}`,
    `H ${(r - right).toFixed(1)}`,
    corner(right, r, y + right),
    `V ${(b - right).toFixed(1)}`,
    corner(right, r - right, b),
    `H ${(x + left).toFixed(1)}`,
    corner(left, x, b - left),
    `V ${(y + left).toFixed(1)}`,
    corner(left, x + left, y),
    'Z',
  ].join(' ')
}

/**
 * Draw a key lying flat, its bow at one end and its teeth at the other.
 *
 * @param key - Where the key is, how long, which way it points and what it is drawn in.
 * @returns SVG markup.
 * @example A solid key inside a node, pointing right
 * ```ts
 * renderKey({ cx: 95, cy: 114, length: 30, direction: 1, colour: theme.tones.success, hollow: false, hole: theme.surface })
 * ```
 */
export function renderKey(key: KeyGlyph): string {
  const bowRadius = key.length * 0.2
  const half = key.length / 2
  const bowX = key.cx - key.direction * (half - bowRadius)
  const tipX = key.cx + key.direction * half
  const width = key.hollow ? 1.8 : 2.4
  const shaftStart = bowX + key.direction * bowRadius
  const teeth = `M ${(tipX - key.direction * 3).toFixed(1)} ${key.cy.toFixed(1)} v 4.5 M ${(tipX - key.direction * 8).toFixed(1)} ${key.cy.toFixed(1)} v 3.5`
  const bow = key.hollow
    ? `<circle cx="${bowX.toFixed(1)}" cy="${key.cy.toFixed(1)}" r="${bowRadius.toFixed(1)}"/>`
    : `<circle cx="${bowX.toFixed(1)}" cy="${key.cy.toFixed(1)}" r="${bowRadius.toFixed(1)}" fill="${key.colour}" stroke="none"/><circle cx="${bowX.toFixed(1)}" cy="${key.cy.toFixed(1)}" r="${(bowRadius * 0.36).toFixed(1)}" fill="${key.hole}" stroke="none"/>`
  return `<g stroke="${key.colour}" stroke-width="${width}" stroke-linecap="round" fill="none">${bow}<path d="M ${shaftStart.toFixed(1)} ${key.cy.toFixed(1)} H ${tipX.toFixed(1)}"/><path d="${teeth}"/></g>`
}

/**
 * Draw an eye looking up at the pipe: the listener on the transport.
 *
 * @param cx - Horizontal centre.
 * @param cy - Vertical centre.
 * @param width - Width from corner to corner.
 * @param colour - What the eye is drawn in.
 * @param glow - How strongly it is lit, from 0 to 1, for the halo behind it.
 * @returns SVG markup.
 * @example The listener, unlit
 * ```ts
 * renderEye(318, 230, 26, theme.text.faint, 0)
 * ```
 */
export function renderEye(cx: number, cy: number, width: number, colour: string, glow: number): string {
  const half = width / 2
  const lid = width * 0.42
  const halo =
    glow > 0 ? `<circle cx="${cx}" cy="${cy}" r="${(half + 7).toFixed(1)}" fill="${colour}" opacity="${(0.2 * glow).toFixed(3)}"/>` : ''
  return `${halo}<path d="M ${(cx - half).toFixed(1)} ${cy} Q ${cx} ${(cy - lid).toFixed(1)} ${(cx + half).toFixed(1)} ${cy} Q ${cx} ${(cy + lid).toFixed(1)} ${(cx - half).toFixed(1)} ${cy} Z" fill="none" stroke="${colour}" stroke-width="1.8" stroke-linejoin="round"/><circle cx="${cx}" cy="${cy}" r="${(width * 0.15).toFixed(1)}" fill="${colour}"/>`
}
