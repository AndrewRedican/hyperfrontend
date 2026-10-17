import type { DoorsCaller, DoorsConfig, DoorsEntry } from '../models/doors'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import type { FigureMetrics } from '../stage/figure'
import type { Rect } from '../stage/geometry'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'
import { figureMetrics, figureStyles, renderArrowhead } from '../stage/figure'

/** Width of a caller's card. */
const CALLER_W = 254

/** Height of a caller's card, and of a door. */
const ROW_H = 72

/** Width of the package's card. */
const PACKAGE_W = 272

/** Radius of the mark on a door. */
const MARK_R = 11

/** Whether a door, or the path to it, went right or wrong. */
type Outcome = 'success' | 'danger'

/** Where everything in the figure sits. */
interface DoorsLayout {
  /** The suite's card. */
  suite: Rect
  /** The consumer's card. */
  consumer: Rect
  /** The package's card. */
  pkg: Rect
  /** The door the suite is sent through. */
  working: Rect
  /** The door only the consumer reaches. */
  broken: Rect
  /** Horizontal centre of the transform on the suite's path. */
  transformX: number
}

/**
 * Lay the figure out for one profile.
 *
 * The callers stand on the left and the package on the right, each caller
 * level with the door it ends up at, so both real paths run straight across
 * and only the path the suite claimed bends.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every position the renderer needs.
 */
function doorsLayout(profile: MediaProfile): DoorsLayout {
  const inset = figureMetrics(profile).insetPx
  const top = inset - 8
  const doorX = profile.width - inset - PACKAGE_W + 18
  const doorW = PACKAGE_W - 36
  const working = { x: doorX, y: top + 46, w: doorW, h: ROW_H - 14 }
  const broken = { x: doorX, y: working.y + 96, w: doorW, h: ROW_H - 14 }
  const pkg = { x: profile.width - inset - PACKAGE_W, y: top, w: PACKAGE_W, h: broken.y + broken.h + 18 - top }
  const workingMid = working.y + working.h / 2
  const brokenMid = broken.y + broken.h / 2
  return {
    suite: { x: inset, y: workingMid - ROW_H / 2, w: CALLER_W, h: ROW_H },
    consumer: { x: inset, y: brokenMid - ROW_H / 2, w: CALLER_W, h: ROW_H },
    pkg,
    working,
    broken,
    transformX: (inset + CALLER_W + pkg.x) / 2,
  }
}

/**
 * Draw a caller's card: its caption and its import.
 *
 * @param caller - What the card says.
 * @param card - Where it sits.
 * @param monoPx - Font size of the mono face.
 * @returns SVG markup for the card.
 */
function renderCaller(caller: DoorsCaller, card: Rect, monoPx: number): string {
  return `<rect class="fig-card fig-card--raised" x="${card.x}" y="${card.y}" width="${card.w}" height="${card.h}" rx="10"/>
    <text class="fig-caps" x="${card.x + 16}" y="${card.y + 26}">${escapeHtml(caller.caption)}</text>
    <text class="dr-code" x="${card.x + 16}" y="${card.y + 26 + monoPx + 16}">${escapeHtml(caller.code)}</text>`
}

/**
 * Draw the tick or the cross a door carries.
 *
 * @param x - Centre of the mark.
 * @param y - Centre of the mark.
 * @param outcome - Which mark.
 * @returns SVG markup for the mark.
 */
function renderMark(x: number, y: number, outcome: Outcome): string {
  const glyph =
    outcome === 'success'
      ? `M ${x - 4.5} ${y + 0.5} L ${x - 1.2} ${y + 4} L ${x + 5} ${y - 3.5}`
      : `M ${x - 4} ${y - 4} L ${x + 4} ${y + 4} M ${x + 4} ${y - 4} L ${x - 4} ${y + 4}`
  return `<g class="dr-mark dr-mark--${outcome}"><circle cx="${x}" cy="${y}" r="${MARK_R}"/><path d="${glyph}"/></g>`
}

/**
 * Draw one door in the package: its condition, the file behind it, its
 * mark and the line under it.
 *
 * @param entry - What the door says.
 * @param door - Where it sits.
 * @param outcome - Whether the file behind it works.
 * @param metrics - The type scale.
 * @returns SVG markup for the door.
 */
function renderDoor(entry: DoorsEntry, door: Rect, outcome: Outcome, metrics: FigureMetrics): string {
  const mid = door.y + door.h / 2
  return `<rect class="dr-door dr-door--${outcome}" x="${door.x}" y="${door.y}" width="${door.w}" height="${door.h}" rx="9"/>
    <text class="dr-code dr-code--strong" x="${door.x + 16}" y="${mid - 4}">${escapeHtml(entry.condition)}</text>
    <text class="dr-code dr-code--muted" x="${door.x + 16}" y="${mid + metrics.monoPx + 2}">${escapeHtml(entry.file)}</text>
    ${renderMark(door.x + door.w - MARK_R - 14, mid, outcome)}`
}

/**
 * Build the stylesheet for the figure, with its theme resolved into it.
 *
 * @param config - The figure as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this figure.
 */
function doorsStyles(config: DoorsConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = figureMetrics(profile)
  return `
${figureStyles(theme, metrics)}
.fig-svg .dr-code { font-family: ${theme.fonts.mono}; font-size: ${metrics.monoPx + 1}px; font-weight: 600; fill: ${theme.text.strong}; }
.fig-svg .dr-code--muted { font-weight: 500; fill: ${theme.text.muted}; }
.dr-package { fill: ${theme.surface}; stroke: ${theme.border}; stroke-width: 1.2; }
.dr-door { fill: ${theme.surfaceRaised}; stroke-width: 1.6; }
.dr-door--success { stroke: ${theme.tones.success}; }
.dr-door--danger { stroke: ${theme.tones.danger}; }
.dr-mark circle { stroke: none; }
.dr-mark path { fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; stroke: ${theme.surfaceRaised}; }
.dr-mark--success circle { fill: ${theme.tones.success}; }
.dr-mark--danger circle { fill: ${theme.tones.danger}; }
.dr-path { fill: none; stroke-width: 2; stroke-linecap: round; }
.dr-path--success { stroke: ${theme.tones.success}; }
.dr-path--danger { stroke: ${theme.tones.danger}; }
.dr-path--ghost { stroke: ${theme.text.faint}; stroke-dasharray: 5 5; }
.dr-head--success path { stroke: ${theme.tones.success}; stroke-width: 2; }
.dr-head--danger path { stroke: ${theme.tones.danger}; stroke-width: 2; }
.dr-transform { fill: ${theme.surfaceRaised}; stroke: ${theme.border}; stroke-width: 1.2; }
`
}

/**
 * Where a suite that says ESM actually went.
 *
 * A package's `exports` map is two doors: `require` to the CommonJS build,
 * `import` to the ES module build. The suite on the left says it tests the
 * ESM build and writes `import()`, but its path runs through a transform that
 * rewrites the call to `require()`, so it walks straight through the CommonJS
 * door and comes back green. The path it claimed, a faint dashed curve, stops
 * short of the ESM door. Only a native ESM consumer, below it, reaches the ESM door, and
 * that door is broken. Nothing moves: the figure is the gap between the path
 * a test names and the path it takes.
 */
export const doorsStage: Stage<DoorsConfig> = defineStage<DoorsConfig>({
  id: 'doors',

  styles: doorsStyles,

  durationMs(): number {
    return 0
  },

  frame({ config, profile }): string {
    const metrics = figureMetrics(profile)
    const layout = doorsLayout(profile)
    const { suite, consumer, pkg, working, broken, transformX } = layout
    const suiteMid = suite.y + suite.h / 2
    const consumerMid = consumer.y + consumer.h / 2
    const transformW = config.transform.length * (metrics.monoPx + 1) * 0.6 + 40
    const transformLeft = transformX - transformW / 2
    const transformRight = transformX + transformW / 2
    const suiteRight = suite.x + suite.w
    const doorLeft = working.x - 3
    const ghostEndY = broken.y + 12
    const ghostEndX = doorLeft - 34
    const paths = `
      <path class="dr-path dr-path--ghost" d="M ${suiteRight} ${suiteMid + 22} C ${suiteRight + 90} ${suiteMid + 22}, ${ghostEndX - 130} ${ghostEndY}, ${ghostEndX} ${ghostEndY}"/>
      <path class="dr-path dr-path--success" d="M ${suiteRight} ${suiteMid} H ${transformLeft.toFixed(1)} M ${transformRight.toFixed(1)} ${suiteMid} H ${doorLeft}"/>
      <g class="dr-head--success">${renderArrowhead(doorLeft, suiteMid, 0, 7)}</g>
      <path class="dr-path dr-path--danger" d="M ${consumer.x + consumer.w} ${consumerMid} H ${doorLeft}"/>
      <g class="dr-head--danger">${renderArrowhead(doorLeft, consumerMid, 0, 7)}</g>`
    const transform = `<rect class="dr-transform" x="${transformLeft.toFixed(1)}" y="${suiteMid - 18}" width="${transformW.toFixed(1)}" height="36" rx="18"/>
      <text class="dr-code" x="${transformX.toFixed(1)}" y="${suiteMid + 5}" text-anchor="middle">${escapeHtml(config.transform)}</text>`
    return `<div class="fig-frame">
      <svg class="fig-svg" viewBox="0 0 ${profile.width} ${profile.height}" width="${profile.width}" height="${profile.height}" aria-hidden="true">
        <rect class="dr-package" x="${pkg.x}" y="${pkg.y}" width="${pkg.w}" height="${pkg.h}" rx="12"/>
        <text class="dr-code dr-code--muted" x="${pkg.x + 18}" y="${pkg.y + 28}">${escapeHtml(config.packageLabel)}</text>
        ${paths}
        ${renderCaller(config.suite, suite, metrics.monoPx)}
        ${renderCaller(config.consumer, consumer, metrics.monoPx)}
        ${transform}
        ${renderDoor(config.working, working, 'success', metrics)}
        ${renderDoor(config.broken, broken, 'danger', metrics)}
      </svg>
    </div>`
  },
})
