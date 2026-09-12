import type { Point } from './layout'

/**
 * A padlock: a shackle standing over a body, drawn about a centre.
 *
 * @param centre - Centre of the body.
 * @param size - Width of the body, in pixels.
 * @param colour - What the lock is drawn in.
 * @param hole - What the keyhole is drawn in.
 * @param scale - How large the lock is drawn relative to its size, for the pop that puts it on the lid.
 * @param opacity - How strongly it is drawn, from 0 to 1.
 * @returns SVG markup.
 * @example A lock fully on the lid
 * ```ts
 * renderLock({ x: 240, y: 176 }, 14, theme.accent, theme.surface, 1, 1)
 * ```
 */
export function renderLock(centre: Point, size: number, colour: string, hole: string, scale: number, opacity: number): string {
  const bodyHeight = size * 0.74
  const shackle = size * 0.3
  const bodyTop = -bodyHeight / 2 + size * 0.12
  return `<g transform="translate(${centre.x.toFixed(1)} ${centre.y.toFixed(1)}) scale(${scale.toFixed(3)})" opacity="${opacity.toFixed(3)}">
    <path d="M ${(-shackle).toFixed(1)} ${bodyTop.toFixed(1)} v ${(-size * 0.22).toFixed(1)} a ${shackle.toFixed(1)} ${shackle.toFixed(1)} 0 0 1 ${(shackle * 2).toFixed(1)} 0 v ${(size * 0.22).toFixed(1)}" fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round"/>
    <rect x="${(-size / 2).toFixed(1)}" y="${bodyTop.toFixed(1)}" width="${size.toFixed(1)}" height="${bodyHeight.toFixed(1)}" rx="2.5" fill="${colour}"/>
    <circle cx="0" cy="${(bodyTop + bodyHeight * 0.48).toFixed(1)}" r="${(size * 0.11).toFixed(1)}" fill="${hole}"/>
  </g>`
}

/**
 * A script file: a page with a folded corner and a few lines of code.
 *
 * @param size - Height of the page, in pixels.
 * @param colour - What the page is drawn in.
 * @returns SVG markup sized to fit a box of that height.
 * @example The intruder's icon
 * ```ts
 * renderScriptIcon(20, theme.tones.danger)
 * ```
 */
export function renderScriptIcon(size: number, colour: string): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="${colour}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M 4.5 1.5 h 7 l 4 4 v 13 h -11 z"/>
    <path d="M 11.5 1.5 v 4 h 4"/>
    <path d="M 7 10 l -1.8 1.8 l 1.8 1.8"/>
    <path d="M 13 10 l 1.8 1.8 l -1.8 1.8"/>
    <path d="M 10.8 9.2 l -1.6 5.2"/>
  </svg>`
}

/**
 * A shelf in miniature: a bar with two tiles standing on it.
 *
 * @param size - Width of the pictogram, in pixels.
 * @param colour - What it is drawn in.
 * @returns SVG markup.
 * @example The pictogram over the shelf's answer column
 * ```ts
 * renderShelfPictogram(18, theme.text.faint)
 * ```
 */
export function renderShelfPictogram(size: number, colour: string): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="${colour}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M 1.5 14.5 h 17"/>
    <rect x="3.5" y="7.5" width="5" height="7" rx="1"/>
    <rect x="11.5" y="7.5" width="5" height="7" rx="1"/>
  </svg>`
}

/**
 * A vault in miniature: a box under a shut lid, with the lock on it.
 *
 * @param size - Width of the pictogram, in pixels.
 * @param colour - What it is drawn in.
 * @returns SVG markup.
 * @example The pictogram over the vault's answer column
 * ```ts
 * renderVaultPictogram(18, theme.text.faint)
 * ```
 */
export function renderVaultPictogram(size: number, colour: string): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="${colour}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3.5" y="7.5" width="13" height="9" rx="1.5"/>
    <path d="M 2 7.5 h 16"/>
    <path d="M 10 11 v 2.2"/>
    <circle cx="10" cy="10.6" r="1.3" fill="${colour}" stroke="none"/>
  </svg>`
}

/**
 * A dot with a soft halo, for a question on its way.
 *
 * @param point - Centre of the dot.
 * @param radius - Radius of the dot; the halo is a little over twice it.
 * @param colour - What the dot is drawn in.
 * @returns SVG markup, or nothing for a dot with no size left.
 * @example A question dot half way along its route
 * ```ts
 * renderDot(routeAt(route, 0.5), 5, theme.accent)
 * ```
 */
export function renderDot(point: Point, radius: number, colour: string): string {
  if (radius <= 0.05) {
    return ''
  }
  return `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${(radius * 2.2).toFixed(1)}" fill="${colour}" opacity="0.18"/><circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${colour}"/>`
}
