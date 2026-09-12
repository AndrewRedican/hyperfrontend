import type { LevelLine, LevelName, LevelsConfig } from '../models/levels'
import type { MediaTheme, ThemeTones } from '../models/theme'
import type { LevelsMetrics } from './layout'
import type { KnobState } from './timeline'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { easeOut, progress, pulse } from '../lib/motion'
import { renderApiChip } from '../stage/api-chip'
import { LEVELS, lineY, stopX } from './layout'
import { GHOST } from './timeline'

/** The tone each level's pip and message are coloured with. */
const TONE_OF: Readonly<Record<LevelName, keyof ThemeTones>> = {
  error: 'danger',
  warn: 'warning',
  log: 'plain',
  info: 'accent',
  debug: 'muted',
}

/** How long the ring around the knob lasts after it lands. */
const LANDING_MS = 700

/** How long the chip takes to dim once the knob sets off. */
const DIM_MS = 250

/** How far a ghosted line sits to the right of a printed one. */
const GHOST_SHIFT_PX = 5

/**
 * Draw the window's title bar.
 *
 * @param title - Text in the bar.
 * @returns Markup for the bar.
 * @example A bar titled for the app
 * ```ts
 * renderChrome('checkout-web')
 * ```
 */
export function renderChrome(title: string): string {
  const buttons = [0, 1, 2].map((index) => `<i class="lv-dot lv-dot--${index}"></i>`).join('')
  return `<div class="lv-chrome"><div class="lv-dots">${buttons}</div><div class="lv-title">${escapeHtml(title)}</div></div>`
}

/**
 * Draw the rail, its stops and the knob.
 *
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param knob - Where the knob is.
 * @param atMs - Offset from the start of the timeline.
 * @returns SVG markup for the scale.
 * @example The scale at the start of the scene
 * ```ts
 * renderScale(metrics, theme, knobAt(moves, 2, 0), 0)
 * ```
 */
export function renderScale(metrics: LevelsMetrics, theme: MediaTheme, knob: KnobState, atMs: number): string {
  const y = metrics.railY
  const rail = `<line x1="${stopX(metrics, 0)}" y1="${y}" x2="${stopX(metrics, LEVELS.length - 1)}" y2="${y}" stroke="${theme.rule}" stroke-width="2" stroke-linecap="round"/>`
  // why: each stop's tick takes its level's tone, the same tone as the pip on that level's line, so the scale and the output share one key without a legend
  const ticks = LEVELS.map(
    (level, index) => `<circle cx="${stopX(metrics, index)}" cy="${y}" r="${metrics.tickPx}" fill="${theme.tones[TONE_OF[level]]}"/>`
  ).join('')
  const x = stopX(metrics, knob.position).toFixed(1)
  const landing = knob.landedAtMs === undefined ? 0 : pulse(atMs, knob.landedAtMs, LANDING_MS)
  const ring =
    landing > 0
      ? `<circle cx="${x}" cy="${y}" r="${(metrics.knobPx + 4 + 9 * landing).toFixed(1)}" fill="none" stroke="${theme.accent}" stroke-width="1.5" opacity="${(0.55 * landing).toFixed(3)}"/>`
      : ''
  const glow = `<circle cx="${x}" cy="${y}" r="${metrics.knobPx * 2.2}" fill="${theme.accent}" opacity="0.2"/>`
  const body = `<circle cx="${x}" cy="${y}" r="${metrics.knobPx}" fill="${theme.accent}"/>`
  return `${rail}${ticks}${ring}${glow}${body}`
}

/**
 * Draw the level words under the stops, the one nearest the knob set strong.
 *
 * @param metrics - The measurements this profile is drawn at.
 * @param knob - Where the knob is.
 * @returns Positioned markup for the words.
 * @example The level words with the knob at rest on log
 * ```ts
 * renderWords(metrics, knobAt(moves, 2, 0))
 * ```
 */
export function renderWords(metrics: LevelsMetrics, knob: KnobState): string {
  const nearest = round(knob.position)
  return LEVELS.map((level, index) => {
    const on = index === nearest ? ' lv-word--on' : ''
    return `<div class="lv-word${on}" style="left:${stopX(metrics, index)}px;top:${metrics.wordY}px">${escapeHtml(level)}</div>`
  }).join('')
}

/**
 * Draw the setter call with the level in force.
 *
 * The name changes when the knob lands rather than when it sets off, and the
 * chip dims while the knob is between stops, so the pop back to full strength
 * is the moment the new level takes effect.
 *
 * @param config - The scene's configuration.
 * @param metrics - The measurements this profile is drawn at.
 * @param knob - Where the knob is.
 * @param atMs - Offset from the start of the timeline.
 * @returns Positioned markup for the chip.
 * @example The chip naming the level at rest
 * ```ts
 * renderChip(config, metrics, knobAt(moves, 2, 0), 0)
 * ```
 */
export function renderChip(config: LevelsConfig, metrics: LevelsMetrics, knob: KnobState, atMs: number): string {
  const level = LEVELS[knob.landed] ?? config.start
  const dim = knob.departedAtMs === undefined ? 0 : easeOut(progress(atMs, knob.departedAtMs, DIM_MS))
  const opacity = (1 - 0.55 * dim).toFixed(3)
  const top = round(metrics.bandPx / 2)
  return `<div class="lv-chip" style="top:${top}px;opacity:${opacity}">${renderApiChip(`${config.api.name}('${level}')`, config.api.mark)}</div>`
}

/**
 * Draw the five logged lines, each as visible as the level in force lets it be.
 *
 * @param config - The scene's configuration.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param bodyHeight - Height of the window body.
 * @param opacities - Each level's opacity, index for index with the scale.
 * @returns Positioned markup for the lines.
 * @example Every line at its opacity for one instant
 * ```ts
 * renderLines(config, metrics, theme, bodyHeight, opacities)
 * ```
 */
export function renderLines(
  config: LevelsConfig,
  metrics: LevelsMetrics,
  theme: MediaTheme,
  bodyHeight: number,
  opacities: readonly number[]
): string {
  return LEVELS.map((level, index) => {
    const line: LevelLine | undefined = config.lines.find((candidate) => candidate.level === level)
    if (line === undefined) {
      return ''
    }
    const opacity = opacities[index] ?? 1
    // why: a ghosted line also sits a few pixels to the right, so its return is a small move as well as a fade
    const shift = ((1 - (opacity - GHOST) / (1 - GHOST)) * GHOST_SHIFT_PX).toFixed(2)
    const tone = theme.tones[TONE_OF[level]]
    const top = round(lineY(metrics, bodyHeight, index) - metrics.linePx / 2)
    return `<div class="lv-line" style="top:${top}px;opacity:${opacity.toFixed(3)};transform:translateX(${shift}px)"><i class="lv-pip" style="background:${tone}"></i><span class="lv-prefix">${escapeHtml(line.prefix)}</span><span class="lv-msg" style="color:${tone}">${escapeHtml(line.message)}</span></div>`
  }).join('')
}
