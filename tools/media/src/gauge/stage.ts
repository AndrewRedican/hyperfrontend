import type { GaugeConfig, GaugeGroup, GaugeTheme, GaugeTone, GaugeTrack } from '../models/gauge'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import { max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'
import { STAGE_ELEMENT_ID } from '../stage/document'
import { resolveGaugeTheme } from './themes'

/** Every tone a theme colours, in the order the stylesheet declares them. */
const TONES: readonly GaugeTone[] = ['plain', 'muted', 'accent', 'success', 'warning', 'danger']

/** Width past which the frame is drawn at its full density. */
const WIDE_ENOUGH = 800

/** How long the closing caption takes to arrive after the last stop. */
const CAPTION_DELAY_MS = 300

/** The face labels and readouts are set in. */
const FONT_STACK = "'Liberation Sans', 'DejaVu Sans', 'Inter', Helvetica, Arial, sans-serif"

/** The face numbers are set in, so a readout does not reflow as it counts. */
const MONO_STACK = "'Liberation Mono', 'DejaVu Sans Mono', 'JetBrains Mono', Menlo, monospace"

/** How the frame is sized for the surface it is being drawn for. */
interface GaugeMetrics {
  /** Margin between the groups and the edge of the frame. */
  insetPx: number
  /** Padding inside a group. */
  padPx: number
  /** Gap between groups. */
  gapPx: number
  /** Corner radius of a group. */
  radiusPx: number
  /** Font size of a group's heading. */
  titlePx: number
  /** Font size of a track's label and readout. */
  labelPx: number
  /** Thickness of a bar drawn across. */
  barPx: number
  /** Font size of the heading and the caption. */
  chromePx: number
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 */
function gaugeMetrics(profile: MediaProfile): GaugeMetrics {
  const wide = profile.width >= WIDE_ENOUGH
  return {
    insetPx: wide ? 28 : 16,
    padPx: wide ? 18 : 12,
    gapPx: wide ? 16 : 10,
    radiusPx: wide ? 12 : 9,
    titlePx: wide ? 12 : 10,
    labelPx: wide ? 13 : 11,
    barPx: wide ? 9 : 7,
    chromePx: wide ? 15 : 12,
  }
}

/**
 * What a track holds at one instant.
 *
 * Before its first stop it holds that stop's value, after its last it holds
 * that one, and in between it is interpolated. Interpolation rather than steps
 * is the whole reason the stage exists: a bar that jumps between stated values
 * is a slideshow, and a bar that travels between them is a quantity.
 *
 * @param track - The quantity.
 * @param atMs - Offset from the start of the timeline.
 * @returns The value, clamped to nothing and unrounded.
 * @example A bar half way through filling
 * ```ts
 * valueAt({ label: 'n', max: 10, stops: [{ atMs: 0, value: 0 }, { atMs: 1_000, value: 10 }] }, 500) // 5
 * ```
 */
export function valueAt(track: GaugeTrack, atMs: number): number {
  const stops = [...track.stops].sort((left, right) => left.atMs - right.atMs)
  const first = stops[0]
  if (first === undefined) {
    return 0
  }
  if (atMs <= first.atMs) {
    return first.value
  }
  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1]
    const next = stops[index]
    if (previous === undefined || next === undefined) {
      continue
    }
    if (atMs <= next.atMs) {
      const span = next.atMs - previous.atMs
      if (span <= 0) {
        return next.value
      }
      return previous.value + (next.value - previous.value) * ((atMs - previous.atMs) / span)
    }
  }
  return stops[stops.length - 1]?.value ?? 0
}

/**
 * When the last stop of the frame passes.
 *
 * @param config - The frame as the scene configured it.
 * @returns The offset at which nothing is still moving.
 */
function settledAt(config: GaugeConfig): number {
  let latest = 0
  for (const group of config.groups) {
    for (const track of group.tracks) {
      for (const stop of track.stops) {
        latest = max(latest, stop.atMs)
      }
    }
  }
  return latest
}

/**
 * Format a track's value for its readout.
 *
 * @param track - The quantity.
 * @param value - What it holds.
 * @returns The readout, unit included.
 */
function readout(track: GaugeTrack, value: number): string {
  const unit = track.unit ?? ''
  return `${value.toFixed(track.decimals ?? 0)}${unit}`
}

/**
 * Draw one track at one instant.
 *
 * @param track - The quantity.
 * @param orientation - Whether the bar runs across or up.
 * @param atMs - Offset from the start of the timeline.
 * @returns Markup for the track.
 */
function renderTrack(track: GaugeTrack, orientation: GaugeGroup['orientation'], atMs: number): string {
  const value = valueAt(track, atMs)
  const fraction = track.max <= 0 ? 0 : min(1, max(0, value / track.max))
  const percent = (fraction * 100).toFixed(2)
  const tone = `g-tone--${track.tone ?? 'accent'}`

  if (orientation === 'column') {
    return `<div class="g-bin">
      <div class="g-bin-trough"><div class="g-bin-fill ${tone}" style="height:${percent}%"></div></div>
      <div class="g-bin-label">${escapeHtml(track.label)}</div>
    </div>`
  }

  const note = track.note === undefined ? '' : `<div class="g-note">${escapeHtml(track.note)}</div>`
  return `<div class="g-track">
    <div class="g-head"><span class="g-label">${escapeHtml(track.label)}</span><span class="g-readout ${tone}">${escapeHtml(readout(track, value))}</span></div>
    <div class="g-trough"><div class="g-fill ${tone}" style="width:${percent}%"></div></div>
    ${note}
  </div>`
}

/**
 * Draw one group at one instant.
 *
 * @param group - The set of quantities.
 * @param atMs - Offset from the start of the timeline.
 * @returns Markup for the group.
 */
function renderGroup(group: GaugeGroup, atMs: number): string {
  const orientation = group.orientation ?? 'row'
  const tracks = group.tracks.map((track) => renderTrack(track, orientation, atMs)).join('')
  const title = group.title === undefined ? '' : `<div class="g-title">${escapeHtml(group.title)}</div>`
  return `<div class="g-group g-group--${orientation}">${title}<div class="g-tracks">${tracks}</div></div>`
}

/**
 * Build the stylesheet for one frame, with its theme resolved into it.
 *
 * @param config - The frame as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @returns CSS for this frame.
 */
function gaugeStyles(config: GaugeConfig, profile: MediaProfile): string {
  const theme: GaugeTheme = resolveGaugeTheme(config.theme)
  const metrics = gaugeMetrics(profile)
  const tones = TONES.map((tone) => `.g-tone--${tone} { color: ${theme.tones[tone]}; background-color: ${theme.tones[tone]}; }`).join('\n')

  return `
#${STAGE_ELEMENT_ID} { background: ${theme.backdrop}; font-family: ${FONT_STACK}; }
.g-frame {
  position: absolute;
  inset: ${metrics.insetPx}px;
  display: flex;
  flex-direction: column;
  gap: ${metrics.gapPx}px;
}
.g-heading {
  flex: none;
  font-size: ${metrics.chromePx}px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: ${theme.label};
}
.g-groups {
  display: flex;
  flex-direction: ${config.stacked === true ? 'column' : 'row'};
  gap: ${metrics.gapPx}px;
  flex: 1 1 auto;
  min-height: 0;
}
.g-group {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: ${metrics.padPx}px;
  border: 1px solid ${theme.panelBorder};
  border-radius: ${metrics.radiusPx}px;
  background: ${theme.panel};
  overflow: hidden;
}
.g-title {
  flex: none;
  font-size: ${metrics.titlePx}px;
  font-weight: 600;
  /* why: a group's title is as often a call as it is a word, and an uppercased call is not a call any more */
  letter-spacing: 0.02em;
  color: ${theme.title};
  margin-bottom: ${metrics.padPx - 4}px;
}
.g-group--row .g-tracks { display: flex; flex-direction: column; gap: ${metrics.padPx - 4}px; margin: auto 0; }
.g-track { display: flex; flex-direction: column; gap: ${metrics.barPx - 4}px; }
.g-head { display: flex; align-items: baseline; justify-content: space-between; gap: ${metrics.padPx}px; }
.g-label { font-size: ${metrics.labelPx}px; color: ${theme.label}; }
.g-readout { font-family: ${MONO_STACK}; font-size: ${metrics.labelPx}px; background-color: transparent !important; }
.g-note { font-size: ${metrics.labelPx - 3}px; color: ${theme.note}; }
.g-trough { height: ${metrics.barPx}px; border-radius: ${metrics.barPx}px; background: ${theme.trough}; overflow: hidden; }
.g-fill { height: 100%; border-radius: ${metrics.barPx}px; }

/* Standing the bars on end is what makes twenty of them legible: the label
   goes under the bar instead of beside it, and the readout goes entirely,
   because a distribution is read as a shape rather than as numbers. */
.g-group--column .g-tracks { display: flex; align-items: flex-end; gap: ${profile.width >= WIDE_ENOUGH ? 3 : 2}px; flex: 1 1 auto; min-height: 0; }
.g-bin { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; height: 100%; }
.g-bin-trough { flex: 1 1 auto; display: flex; align-items: flex-end; background: ${theme.trough}; border-radius: 2px; overflow: hidden; }
.g-bin-fill { width: 100%; border-radius: 2px; }
.g-bin-label {
  flex: none;
  margin-top: 4px;
  font-family: ${MONO_STACK};
  font-size: ${metrics.labelPx - 4}px;
  color: ${theme.note};
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
}
.g-caption { flex: none; font-size: ${metrics.chromePx}px; color: ${theme.tones.success}; }
${tones}
`
}

/**
 * Quantities moving between the values a scene states they hold.
 *
 * For the packages whose subject is a number rather than a call: a countdown
 * that can be held and continued, a distribution that is not the flat one
 * `Math.random` gives you, a confidence a scan arrived at, a count that grows
 * every time you mount something and never comes back down.
 *
 * A track is a label, a maximum and a list of moments it is known to hold a
 * value at; everything between two of those moments is interpolated. That is
 * the whole model, and it is enough for all four of those stories, because
 * "holds still here" is just two stops carrying the same number.
 */
export const gaugeStage: Stage<GaugeConfig> = defineStage<GaugeConfig>({
  id: 'gauge',

  styles: gaugeStyles,

  durationMs(config: GaugeConfig): number {
    return settledAt(config) + (config.restMs ?? 1200)
  },

  frame({ config, atMs }): string {
    const groups = config.groups.map((group) => renderGroup(group, atMs)).join('')
    const heading = config.heading === undefined ? '' : `<div class="g-heading">${escapeHtml(config.heading)}</div>`
    const caption =
      config.caption !== undefined && atMs >= settledAt(config) + CAPTION_DELAY_MS
        ? `<div class="g-caption">${escapeHtml(config.caption)}</div>`
        : ''

    return `<div class="g-frame">${heading}<div class="g-groups">${groups}</div>${caption}</div>`
  },
})
