import type { DerivedConfig } from '../models/derived'
import type { MediaTheme } from '../models/theme'
import type { DerivedLayout, DerivedMetrics } from './layout'
import type { DerivedTimeline } from './timeline'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { easeIn, easeOut, progress } from '../lib/motion'
import { renderApiChip } from '../stage/api-chip'
import { dropAt, dropPath, wireAt } from './layout'
import { DROP_MS, FIRE_MS, FLASH_MS, LIGHT_DELAY_MS, LIGHT_MS, WIRE_MS, beatIndexAt, levelAt } from './timeline'

/** How much of its colour a chip keeps before it fires, as a percentage. */
const CHIP_DIM_PCT = 42

/** How far the ring round a fired chip grows past its edge, at compact size. */
const FIRE_REACH = 6

/** Radius of a lit lamp's glow, as a multiple of the lamp's radius. */
const GLOW_RADIUS = 2.1

/** How far a ripple grows past the lamp's rim, as a multiple of the lamp's radius. */
const RIPPLE_REACH = 1.5

/** Everything the render helpers need at one instant. */
export interface DerivedFrame {
  /** The store as the scene configured it. */
  config: DerivedConfig
  /** Every position the renderer draws at. */
  layout: DerivedLayout
  /** Every beat of the store. */
  timeline: DerivedTimeline
  /** The measurements this profile is drawn at. */
  metrics: DerivedMetrics
  /** The visual tokens this variant is drawn with. */
  theme: MediaTheme
  /** Offset from the start of the timeline. */
  atMs: number
}

/**
 * A colour at a fraction of its strength, for text and fills that fade.
 *
 * Written as a mix rather than an `opacity`, because an opacity on an HTML
 * element makes the browser composite it through a surface of its own, and
 * a headless screenshot can catch that surface before it has been cleared.
 *
 * @param colour - The theme token.
 * @param level - Strength from 0 to 1.
 * @returns A CSS colour.
 */
function faded(colour: string, level: number): string {
  return `color-mix(in srgb, ${colour} ${round(level * 100)}%, transparent)`
}

/**
 * Whether a name holds in a beat.
 *
 * @param frame - The instant being drawn.
 * @param beat - Index of the beat.
 * @param name - The selector's name, as the scene lists it.
 * @returns True when the beat lists it.
 */
function holdsAt(frame: DerivedFrame, beat: number, name: string): boolean {
  return frame.timeline.beats[beat]?.holds.includes(name) ?? false
}

/**
 * Whether a lamp is lit in a beat.
 *
 * @param frame - The instant being drawn.
 * @param beat - Index of the beat.
 * @param flag - The lamp's flag.
 * @returns True when the beat has the flag set.
 */
function litAt(frame: DerivedFrame, beat: number, flag: string): boolean {
  return frame.timeline.beats[beat]?.flags[flag] ?? false
}

/**
 * Draw the rail: the word to its left and one chip per action, dim until it fires.
 *
 * @param frame - The instant being drawn.
 * @returns HTML for the label and the chips.
 * @example The rail at the start, every chip dim
 * ```ts
 * renderRail({ ...frame, atMs: 0 })
 * ```
 */
export function renderRail(frame: DerivedFrame): string {
  const { config, layout, metrics, atMs } = frame
  const label = `<div class="dv-rail-label" style="left:${layout.railLabelLeft}px;top:${(metrics.railYPx - metrics.labelPx / 2).toFixed(1)}px">${escapeHtml(config.railLabel)}</div>`
  const top = round(metrics.railYPx - metrics.chipHPx / 2)
  const chips = config.actions
    .map((action, index) => {
      const slot = layout.chips[index]
      if (slot === undefined) {
        return ''
      }
      const on = atMs >= action.atMs ? 100 : CHIP_DIM_PCT
      return `<div class="dv-chip-slot" style="left:${slot.left}px;top:${top}px;--dv-on:${on}%">${renderApiChip(action.name, config.mark)}</div>`
    })
    .join('')
  return `${label}${chips}`
}

/**
 * Draw the ring that spreads from a chip as it fires.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup, or nothing while no chip is firing.
 * @example The ring a tenth of a second after the first chip fires
 * ```ts
 * renderFires({ ...frame, atMs: 1_500 })
 * ```
 */
export function renderFires(frame: DerivedFrame): string {
  const { config, layout, metrics, theme, atMs } = frame
  return config.actions
    .map((action, index) => {
      const slot = layout.chips[index]
      const t = progress(atMs, action.atMs, FIRE_MS)
      if (slot === undefined || t <= 0 || t >= 1) {
        return ''
      }
      const reach = FIRE_REACH * metrics.scale * easeOut(t)
      const x = slot.left - reach
      const y = metrics.railYPx - metrics.chipHPx / 2 - reach
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(slot.width + 2 * reach).toFixed(1)}" height="${(metrics.chipHPx + 2 * reach).toFixed(1)}" rx="999" fill="none" stroke="${theme.accent}" stroke-width="1.5" opacity="${(0.85 * (1 - t)).toFixed(3)}"/>`
    })
    .join('')
}

/**
 * Draw the lamps and their names, lit ones in their tone and a changed one rippling.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup.
 * @example The lamps with the first token just landed
 * ```ts
 * renderLamps({ ...frame, atMs: 1_950 })
 * ```
 */
export function renderLamps(frame: DerivedFrame): string {
  const { config, layout, timeline, metrics, theme, atMs } = frame
  const beat = beatIndexAt(timeline, atMs)
  const current = timeline.beats[beat]
  return config.lamps
    .map((lamp, index) => {
      const at = layout.lamps[index]
      if (at === undefined || current === undefined) {
        return ''
      }
      const lit = current.flags[lamp.flag] ?? false
      const tone = theme.tones[lamp.tone]
      const flash = current.changed.includes(lamp.flag) ? progress(atMs, current.landsAt, FLASH_MS) : 1
      const ripple =
        flash < 1
          ? `<circle cx="${at.x}" cy="${at.y}" r="${(metrics.lampRPx * (1 + RIPPLE_REACH * easeOut(flash))).toFixed(1)}" fill="none" stroke="${lit ? tone : theme.text.muted}" stroke-width="1.5" opacity="${(0.8 * (1 - flash)).toFixed(3)}"/>`
          : ''
      const glow = lit
        ? `<circle cx="${at.x}" cy="${at.y}" r="${(metrics.lampRPx * GLOW_RADIUS).toFixed(1)}" fill="${tone}" opacity="${(0.16 + 0.2 * (1 - flash)).toFixed(3)}"/>`
        : ''
      const bulb = `<circle cx="${at.x}" cy="${at.y}" r="${metrics.lampRPx}" fill="${lit ? tone : theme.rule}" stroke="${lit ? tone : theme.border}" stroke-width="1.5"/>`
      const glint = lit
        ? `<circle cx="${(at.x - metrics.lampRPx * 0.32).toFixed(1)}" cy="${(at.y - metrics.lampRPx * 0.32).toFixed(1)}" r="${(metrics.lampRPx * 0.28).toFixed(1)}" fill="${theme.text.strong}" opacity="0.55"/>`
        : ''
      const label = `<text x="${(at.x - metrics.lampRPx - metrics.lampLabelGapPx).toFixed(1)}" y="${at.y}" class="dv-mono dv-lamp-label" text-anchor="end" dominant-baseline="central" fill="${lit ? tone : theme.text.muted}" font-weight="${lit ? 600 : 500}">${escapeHtml(lamp.flag)}</text>`
      return `${ripple}${glow}${bulb}${glint}${label}`
    })
    .join('')
}

/**
 * Draw every wire: all of them faint, and the ones carrying a lit lamp to a
 * holding name drawn over the top in the lamp's tone.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup.
 * @example The wires while the first name is lighting
 * ```ts
 * renderWires({ ...frame, atMs: 2_200 })
 * ```
 */
export function renderWires(frame: DerivedFrame): string {
  const { config, layout, timeline, metrics, theme, atMs } = frame
  const beat = beatIndexAt(timeline, atMs)
  const landsAt = timeline.beats[beat]?.landsAt ?? 0
  const idle = layout.wires
    .map(
      (wire) =>
        `<path d="${wire.d}" fill="none" stroke="${theme.border}" stroke-width="1.5"${wire.negated ? ' stroke-dasharray="3 4"' : ''}/>`
    )
    .join('')
  const live = layout.wires
    .map((wire) => {
      const lamp = config.lamps[wire.lamp]
      const name = config.names[wire.name]
      if (lamp === undefined || name === undefined) {
        return ''
      }
      const onNow = holdsAt(frame, beat, name.name) && litAt(frame, beat, lamp.flag)
      const onBefore = beat === 0 ? onNow : holdsAt(frame, beat - 1, name.name) && litAt(frame, beat - 1, lamp.flag)
      const level = levelAt(onBefore, onNow, landsAt, 0, WIRE_MS, atMs)
      if (level <= 0) {
        return ''
      }
      const tone = theme.tones[lamp.tone]
      const drawing = onNow && !onBefore && level < 1
      const reveal = drawing ? ` pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="${(1 - level).toFixed(3)}"` : ''
      const opacity = drawing ? 1 : level
      const tip = drawing ? wireAt(wire, level) : undefined
      const spark =
        tip === undefined
          ? ''
          : `<circle cx="${tip.x.toFixed(1)}" cy="${tip.y.toFixed(1)}" r="${(metrics.lampRPx * 0.45).toFixed(1)}" fill="${tone}"/>`
      return `<path d="${wire.d}" fill="none" stroke="${tone}" stroke-width="5" stroke-linecap="round" opacity="${(0.18 * opacity).toFixed(3)}"${reveal}/><path d="${wire.d}" fill="none" stroke="${tone}" stroke-width="2" stroke-linecap="round" opacity="${opacity.toFixed(3)}"${reveal}/>${spark}`
    })
    .join('')
  return `${idle}${live}`
}

/**
 * Draw the derived names, the ones that hold on a band with a dot.
 *
 * @param frame - The instant being drawn.
 * @returns HTML for the header chip and one row per name.
 * @example The names at rest after the second action
 * ```ts
 * renderNames({ ...frame, atMs: 5_000 })
 * ```
 */
export function renderNames(frame: DerivedFrame): string {
  const { config, layout, timeline, metrics, theme, atMs } = frame
  const beat = beatIndexAt(timeline, atMs)
  const landsAt = timeline.beats[beat]?.landsAt ?? 0
  const head = `<div class="dv-head" style="left:${metrics.nameXPx}px;top:${round(metrics.headYPx - metrics.chipHPx / 2)}px">${renderApiChip(config.api, config.mark)}</div>`
  const rows = config.names
    .map((name, index) => {
      const at = layout.names[index]
      if (at === undefined) {
        return ''
      }
      const onNow = holdsAt(frame, beat, name.name)
      const onBefore = beat === 0 ? onNow : holdsAt(frame, beat - 1, name.name)
      const level = levelAt(onBefore, onNow, landsAt, LIGHT_DELAY_MS, LIGHT_MS, atMs)
      const colour = `color-mix(in srgb, ${theme.text.strong} ${round(level * 100)}%, ${theme.text.muted})`
      const band = faded(theme.accentSoft, level)
      return `<div class="dv-name" style="left:${at.x}px;top:${round(at.y - metrics.bandHPx / 2)}px;color:${colour}"><span class="dv-name__band" style="background:${band};border-color:${band}"></span><span class="dv-name__dot" style="background:${faded(theme.accent, level)}"></span><span class="dv-name__text">${escapeHtml(name.name)}</span></div>`
    })
    .join('')
  return `${head}${rows}`
}

/**
 * Draw the token while one is falling from a chip to a lamp.
 *
 * @param frame - The instant being drawn.
 * @returns SVG markup, or nothing while no token is in the air.
 * @example The token half way down its first fall
 * ```ts
 * renderToken({ ...frame, atMs: 1_650 })
 * ```
 */
export function renderToken(frame: DerivedFrame): string {
  const { config, layout, timeline, metrics, theme, atMs } = frame
  const beat = beatIndexAt(timeline, atMs)
  const next = timeline.beats[beat + 1]
  const chip = layout.chips[beat]
  if (next === undefined || chip === undefined || atMs < next.firesAt) {
    return ''
  }
  const lampIndex = config.lamps.findIndex((lamp) => lamp.flag === next.target)
  const lamp = layout.lamps[lampIndex]
  if (lamp === undefined) {
    return ''
  }
  const at = dropAt(dropPath(chip, lamp, metrics), easeIn(progress(atMs, next.firesAt, DROP_MS)))
  return `<circle cx="${at.x.toFixed(1)}" cy="${at.y.toFixed(1)}" r="${(metrics.tokenRPx * 2.2).toFixed(1)}" fill="${theme.accent}" opacity="0.18"/><circle cx="${at.x.toFixed(1)}" cy="${at.y.toFixed(1)}" r="${metrics.tokenRPx}" fill="${theme.accent}"/>`
}
