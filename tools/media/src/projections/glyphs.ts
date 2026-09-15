import type { SurfaceGlyph } from '../models/projections'

/**
 * The line drawing of each surface glyph, on a 24 unit grid centred on the
 * origin, drawn with `currentColor` at stroke weight 1.7.
 */
const GLYPHS: Readonly<Record<SurfaceGlyph, string>> = {
  reference:
    '<path d="M -8 -6 h 16 M -8 0 h 16 M -8 6 h 10"/><circle cx="-11" cy="-6" r="0.9" fill="currentColor" stroke="none"/><circle cx="-11" cy="0" r="0.9" fill="currentColor" stroke="none"/><circle cx="-11" cy="6" r="0.9" fill="currentColor" stroke="none"/>',
  book: '<path d="M -10 -7 C -6 -8.5, -2 -8, 0 -6 C 2 -8, 6 -8.5, 10 -7 V 7 C 6 6, 2 6.5, 0 8 C -2 6.5, -6 6, -10 7 Z"/><path d="M 0 -6 V 8"/>',
  checklist: '<rect x="-9" y="-9" width="18" height="18" rx="3"/><path d="M -4.5 0.5 l 3 3 l 6 -7"/>',
  bulb: '<path d="M -5.5 5 A 7.5 7.5 0 1 1 5.5 5 V 7.5 H -5.5 Z"/><path d="M -3 10.5 h 6"/>',
  tag: '<path d="M -9 -3 V -8 a 1.5 1.5 0 0 1 1.5 -1.5 H -2.5 L 9.5 2.5 L 2.5 9.5 L -9 -2 Z"/><circle cx="-5" cy="-5" r="1.4" fill="currentColor" stroke="none"/>',
  cube: '<path d="M 0 -9.5 L 8.5 -4.7 V 4.7 L 0 9.5 L -8.5 4.7 V -4.7 Z"/><path d="M -8.5 -4.7 L 0 0 L 8.5 -4.7"/><path d="M 0 0 V 9.5"/>',
  document:
    '<path d="M -7 -10 H 2.5 L 7 -5.5 V 10 H -7 Z"/><path d="M 2.5 -10 V -5.5 H 7"/><path d="M -3.5 -1 h 7 M -3.5 3 h 7 M -3.5 7 h 4"/>',
  film: '<rect x="-10" y="-7" width="20" height="14" rx="3"/><path d="M -2.5 -3.5 L 3.5 0 L -2.5 3.5 Z" fill="currentColor" stroke="none"/>',
}

/**
 * Draw one surface glyph.
 *
 * @param glyph - Which glyph.
 * @param x - Horizontal centre.
 * @param y - Vertical centre.
 * @param colour - What it is drawn in.
 * @returns SVG markup for the glyph.
 */
export function renderSurfaceGlyph(glyph: SurfaceGlyph, x: number, y: number, colour: string): string {
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" style="color:${colour}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${GLYPHS[glyph]}</g>`
}
