import type { Mark } from '../models/banner'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { escapeHtml } from '../lib/escape-html'

/** The drawing surface every mark shares: a 32 unit square with a four unit margin. */
const VIEW_BOX = '0 0 32 32'

/** Stroke weight the whole family is drawn in, in view box units. */
const STROKE_WIDTH = 2

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
  const shapes = mark
    .map((shape) => {
      const attrs = entries(shape.attrs)
        .map(([key, value]) => `${escapeHtml(key)}="${escapeHtml(`${value}`)}"`)
        .join(' ')
      const solid = shape.solid === true ? ' fill="currentColor" stroke="none"' : ''
      return `<${shape.as} ${attrs}${solid}/>`
    })
    .join('')
  return `<svg class="${className}" viewBox="${VIEW_BOX}" fill="none" stroke="currentColor" stroke-width="${STROKE_WIDTH}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes}</svg>`
}
