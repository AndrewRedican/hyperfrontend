import type { MediaProfile } from '../models/profile'
import type { MediaTheme } from '../models/theme'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'

/** Width past which a figure is drawn at its full type size. */
const WIDE_ENOUGH = 800

/**
 * How a figure is sized for the surface it is being drawn for.
 *
 * Every article figure shares one type scale, so a reader moving from one to
 * the next meets the same sizes for the same roles: a title, a label, a note
 * under a label, a value set in the mono face. The scale steps down once for
 * a narrow surface rather than sliding, because a diagram with fewer pixels
 * needs fewer words at the same size, not the same words smaller.
 */
export interface FigureMetrics {
  /** Margin between the drawing and the edge of the frame. */
  insetPx: number
  /** Font size of the one line a figure is about, when it has one. */
  titlePx: number
  /** Font size of a label on a node, a card or a row. */
  labelPx: number
  /** Font size of the line under a label. */
  notePx: number
  /** Font size of a date, a version or a name set in the mono face. */
  monoPx: number
  /** Corner radius of a card. */
  radiusPx: number
}

/**
 * Size a figure for the surface it is being drawn for.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the figure stages share.
 * @example The label size at the article column's width
 * ```ts
 * figureMetrics(profile).labelPx // 13.5
 * ```
 */
export function figureMetrics(profile: MediaProfile): FigureMetrics {
  const wide = profile.width >= WIDE_ENOUGH
  return {
    insetPx: wide ? 36 : 22,
    titlePx: wide ? 17 : 14.5,
    labelPx: wide ? 13.5 : 12,
    notePx: wide ? 11.5 : 10.5,
    monoPx: wide ? 12 : 11,
    radiusPx: wide ? 10 : 8,
  }
}

/**
 * The stylesheet the figure stages share, with the theme resolved into it.
 *
 * Text classes are for SVG `<text>` elements, which is where figures set their
 * words: a diagram positions its labels against its own geometry, and SVG is
 * the one place a label's position and the line it labels are in the same
 * coordinate space. The classes name roles rather than sizes, so a stage
 * says what a run of text is and the scale decides how large that is.
 *
 * @param theme - The visual tokens this variant is drawn with.
 * @param metrics - The measurements this profile is drawn at.
 * @returns CSS for the `.fig-*` classes.
 * @example A stage's stylesheet built on the shared classes
 * ```ts
 * return `${figureStyles(theme, metrics)} .my-stage { ... }`
 * ```
 */
export function figureStyles(theme: MediaTheme, metrics: FigureMetrics): string {
  return `
.fig-frame { position: absolute; inset: 0; }
.fig-svg { position: absolute; inset: 0; overflow: visible; }
.fig-svg text { font-family: ${theme.fonts.sans}; }
.fig-title { font-size: ${metrics.titlePx}px; font-weight: 700; fill: ${theme.text.strong}; letter-spacing: -0.01em; }
.fig-label { font-size: ${metrics.labelPx}px; font-weight: 600; fill: ${theme.text.strong}; }
.fig-plain { font-size: ${metrics.labelPx}px; font-weight: 500; fill: ${theme.text.plain}; }
.fig-note { font-size: ${metrics.notePx}px; font-weight: 500; fill: ${theme.text.muted}; }
.fig-faint { font-size: ${metrics.notePx}px; font-weight: 500; fill: ${theme.text.faint}; }
.fig-mono { font-family: ${theme.fonts.mono}; font-size: ${metrics.monoPx}px; font-weight: 500; fill: ${theme.text.muted}; }
.fig-mono--strong { fill: ${theme.text.strong}; font-weight: 600; }
.fig-mono--accent { fill: ${theme.tones.accent}; font-weight: 600; }
.fig-accent { fill: ${theme.tones.accent}; }
.fig-caps { font-size: ${round(metrics.notePx * 0.92)}px; font-weight: 700; fill: ${theme.text.muted}; letter-spacing: 0.12em; text-transform: uppercase; }
.fig-caption { font-size: ${metrics.labelPx}px; font-weight: 600; fill: ${theme.text.strong}; font-style: italic; }
.fig-card { fill: ${theme.surface}; stroke: ${theme.border}; stroke-width: 1.2; }
.fig-card--raised { fill: ${theme.surfaceRaised}; }
.fig-card--soft { fill: ${theme.accentSoft}; stroke: ${theme.accentSoft}; }
.fig-rule { stroke: ${theme.rule}; stroke-width: 1; }
.fig-edge { stroke: ${theme.border}; stroke-width: 1.6; fill: none; stroke-linecap: round; }
.fig-edge--accent { stroke: ${theme.accent}; }
.fig-edge--dashed { stroke-dasharray: 4 4; }
`
}

/**
 * Lay lines of text out as one SVG text element.
 *
 * SVG text does not wrap, so a figure states its line breaks and this places
 * each line a step below the last. The first line sits on `y`; `anchor`
 * places the block against its horizontal position the way `text-anchor`
 * does.
 *
 * @param lines - The lines, top to bottom.
 * @param x - Horizontal position.
 * @param y - Baseline of the first line.
 * @param className - Class the element carries, one of the `.fig-*` text roles.
 * @param lineHeightPx - Distance between baselines.
 * @param anchor - `start`, `middle` or `end`.
 * @returns SVG markup for the text.
 * @example A two-line note under a node
 * ```ts
 * renderLines(['reads the tree', 'writes nothing'], node.x, node.y + 40, 'fig-note', 15, 'middle')
 * ```
 */
export function renderLines(
  lines: readonly string[],
  x: number,
  y: number,
  className: string,
  lineHeightPx: number,
  anchor: 'start' | 'middle' | 'end' = 'start'
): string {
  const spans = lines
    .map((line, index) => `<tspan x="${x.toFixed(1)}" y="${(y + index * lineHeightPx).toFixed(1)}">${escapeHtml(line)}</tspan>`)
    .join('')
  return `<text class="${className}" text-anchor="${anchor}">${spans}</text>`
}

/**
 * The `d` of an arrowhead pointing along a direction, for the end of an edge.
 *
 * @param x - Tip of the arrowhead.
 * @param y - Tip of the arrowhead.
 * @param angleDeg - Direction the arrow points, in degrees clockwise from east.
 * @param size - Length of each barb.
 * @returns SVG markup for the open arrowhead.
 * @example An arrowhead at the end of a rightward edge
 * ```ts
 * renderArrowhead(edge.end.x, edge.end.y, 0, 7)
 * ```
 */
export function renderArrowhead(x: number, y: number, angleDeg: number, size: number): string {
  return `<path d="M ${-size} ${-size * 0.55} L 0 0 L ${-size} ${size * 0.55}" fill="none" stroke-linecap="round" stroke-linejoin="round" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angleDeg.toFixed(1)})"/>`
}
