import type { Mark } from '../models/banner'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { escapeHtml } from '../lib/escape-html'

/** The drawing surface every mark shares: a 32 unit square with a four unit margin. */
const VIEW_BOX = '0 0 32 32'

/** Stroke weight the whole family is drawn in, in view box units. */
const STROKE_WIDTH = 2

/** Side of the grid every mark is drawn on, in view box units. */
const GRID = 32

/**
 * The shapes of a mark as SVG elements, with no surface around them.
 *
 * @param mark - The geometry to draw.
 * @returns The mark's elements, ready to be placed inside any SVG container.
 */
function markShapes(mark: Mark): string {
  return mark
    .map((shape) => {
      const attrs = entries(shape.attrs)
        .map(([key, value]) => `${escapeHtml(key)}="${escapeHtml(`${value}`)}"`)
        .join(' ')
      const solid = shape.solid === true ? ' fill="currentColor" stroke="none"' : ''
      return `<${shape.as} ${attrs}${solid}/>`
    })
    .join('')
}

/**
 * Draw an identity mark as inline SVG.
 *
 * Colour is never set here. The geometry inherits `currentColor` for both its
 * strokes and its solid accent, so a mark takes the colour of whatever it is
 * placed in and one drawing serves every theme.
 *
 * @param mark - The geometry to draw.
 * @param className - Class the element carries, for the caller to size and colour it.
 * @returns SVG markup.
 * @example Drawing a mark in the accent colour
 * ```ts
 * `<span style="color:${theme.accent}">${renderMark(mark, 'banner-mark')}</span>`
 * ```
 */
export function renderMark(mark: Mark, className: string): string {
  return `<svg class="${className}" viewBox="${VIEW_BOX}" fill="none" stroke="currentColor" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${markShapes(mark)}</svg>`
}

/**
 * Draw an identity mark inside an SVG that is already being drawn, centred on
 * a point.
 *
 * A figure that places marks among its own geometry cannot nest a sized
 * `<svg>` for each one without fighting the outer coordinate space, so the
 * mark is placed as a group scaled from its grid to the size asked for. The
 * stroke scales with it, which keeps the weight the family is drawn in
 * proportional to the mark's size, exactly as {@link renderMark} does.
 *
 * @param mark - The geometry to draw.
 * @param x - Horizontal centre, in the outer SVG's units.
 * @param y - Vertical centre, in the outer SVG's units.
 * @param size - Side of the square the mark fills.
 * @param colour - What the strokes and the solid accent are painted with.
 * @returns SVG markup for the group.
 * @example A package mark drawn at the centre of a node
 * ```ts
 * renderMarkAt(mark, node.x, node.y, 20, theme.accent)
 * ```
 */
export function renderMarkAt(mark: Mark, x: number, y: number, size: number, colour: string): string {
  const scale = size / GRID
  return `<g transform="translate(${(x - size / 2).toFixed(1)} ${(y - size / 2).toFixed(1)}) scale(${scale.toFixed(4)})" style="color:${colour}" fill="none" stroke="currentColor" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round">${markShapes(mark)}</g>`
}
