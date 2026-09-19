import type { MediaTheme } from '../models/theme'
import type { FigureMetrics } from '../stage/figure'
import type { Rect } from '../stage/geometry'
import { escapeHtml } from '../lib/escape-html'

/** Height of a window's chrome bar. */
export const CHROME_H = 30

/** Radius of a numbered badge. */
export const BADGE_R = 9

/**
 * The stylesheet the window parts are drawn with, with the theme resolved into it.
 *
 * Shared by every figure that draws a host window with another application
 * seated inside it, so the host, the shell's outline, the boundary and the
 * hostee look the same wherever a reader meets them.
 *
 * @param theme - The visual tokens this variant is drawn with.
 * @param metrics - The measurements this profile is drawn at.
 * @returns CSS for the `.sm-*` classes.
 * @example A figure's stylesheet built on the shared parts
 * ```ts
 * return `${figureStyles(theme, metrics)}${seamPartStyles(theme, metrics)} .my-figure { ... }`
 * ```
 */
export function seamPartStyles(theme: MediaTheme, metrics: FigureMetrics): string {
  return `
.sm-window { fill: ${theme.surface}; stroke: ${theme.border}; stroke-width: 1.4; }
.sm-window--hostee { fill: ${theme.surfaceRaised}; }
.sm-chrome { fill: ${theme.chrome.bar}; }
.sm-pill { fill: ${theme.surface}; stroke: ${theme.rule}; stroke-width: 1; }
.sm-bar { fill: ${theme.rule}; }
.sm-bar--hostee { fill: ${theme.accentSoft}; }
.sm-shell { fill: none; stroke: ${theme.accent}; stroke-width: 1.8; }
.sm-tab { fill: ${theme.surfaceRaised}; stroke: ${theme.accent}; stroke-width: 1.8; }
.sm-tab-label { font-family: ${theme.fonts.mono}; font-size: ${metrics.monoPx}px; font-weight: 600; fill: ${theme.tones.accent}; }
.sm-boundary { fill: none; stroke: ${theme.text.muted}; stroke-width: 1.8; stroke-dasharray: 6 5; }
.sm-wire { stroke: ${theme.accent}; stroke-width: 2; stroke-linecap: round; }
.sm-badge { font-family: ${theme.fonts.mono}; font-size: ${metrics.notePx}px; font-weight: 700; fill: ${theme.transparent ? theme.plate : '#ffffff'}; }
.sm-legend { font-size: ${metrics.notePx + 0.5}px; font-weight: 600; fill: ${theme.text.plain}; }
`
}

/**
 * Draw a window's chrome: three buttons and an address pill.
 *
 * @param rect - The window.
 * @param origin - What the address bar says.
 * @param theme - The visual tokens this variant is drawn with.
 * @param badge - A badge drawn at the end of the address pill, or nothing.
 * @returns SVG markup for the chrome.
 */
export function renderChrome(rect: Rect, origin: string, theme: MediaTheme, badge: string): string {
  const dots = theme.chrome.buttons
    .map((colour, index) => `<circle cx="${rect.x + 16 + index * 13}" cy="${rect.y + CHROME_H / 2}" r="4" fill="${colour}"/>`)
    .join('')
  const pillX = rect.x + 62
  const pillW = origin.length * 7.2 + 24
  return `<path d="M ${rect.x} ${rect.y + CHROME_H} V ${rect.y + 10} a 10 10 0 0 1 10 -10 H ${rect.x + rect.w - 10} a 10 10 0 0 1 10 10 V ${rect.y + CHROME_H} Z" class="sm-chrome"/>
    <line class="fig-rule" x1="${rect.x}" y1="${rect.y + CHROME_H}" x2="${rect.x + rect.w}" y2="${rect.y + CHROME_H}"/>${dots}
    <rect class="sm-pill" x="${pillX}" y="${rect.y + 7}" width="${pillW.toFixed(1)}" height="${CHROME_H - 14}" rx="8"/>
    <text class="fig-mono" x="${pillX + 12}" y="${rect.y + CHROME_H / 2 + 4}">${escapeHtml(origin)}</text>${badge}`
}

/**
 * Draw a numbered badge.
 *
 * @param x - Horizontal centre.
 * @param y - Vertical centre.
 * @param number - The number inside it.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the badge.
 */
export function renderBadge(x: number, y: number, number: number, theme: MediaTheme): string {
  return `<circle cx="${x}" cy="${y}" r="${BADGE_R}" fill="${theme.accent}"/><text class="sm-badge" x="${x}" y="${y + 3.5}" text-anchor="middle">${number}</text>`
}

/**
 * Draw placeholder content: a headline bar and lines under it.
 *
 * @param x - Left edge.
 * @param y - Top edge.
 * @param widths - Width of each line, the first drawn as a headline.
 * @param className - Class the bars carry.
 * @returns SVG markup for the bars.
 */
export function renderBars(x: number, y: number, widths: readonly number[], className: string): string {
  return widths
    .map((width, index) => {
      const height = index === 0 ? 14 : 8
      const top = index === 0 ? y : y + 26 + (index - 1) * 18
      return `<rect class="${className}" x="${x}" y="${top}" width="${width}" height="${height}" rx="${height / 2}"/>`
    })
    .join('')
}
