import type { Dial, DialConfig, DialTone } from '../models/dial'
import type { MediaProfile } from '../models/profile'
import type { Stage } from '../models/stage'
import type { MediaTheme } from '../models/theme'
import { ceil, max, min, PI } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { valueAt } from '../gauge/stage'
import { escapeHtml } from '../lib/escape-html'
import { defineStage } from '../stage/define-stage'

/** Width past which the frame is drawn at its full density. */
const WIDE_ENOUGH = 800

/** How long the overlay takes to slide in or out. */
const SLIDE_MS = 320

/** How long the closing caption takes to arrive after the last stop. */
const CAPTION_DELAY_MS = 300

/** How the frame is sized for the surface it is being drawn for. */
interface DialMetrics {
  /** Margin between the content and the edge of the frame. */
  insetPx: number
  /** Diameter of a ring. */
  ringPx: number
  /** Stroke width of a ring. */
  strokePx: number
  /** Font size of a dial's title. */
  titlePx: number
  /** Font size of the readout inside a ring. */
  readoutPx: number
  /** Font size of the word under a ring. */
  statePx: number
  /** Font size of the heading. */
  headingPx: number
  /** Font size of the caption. */
  captionPx: number
  /** Width of the overlay card. */
  overlayPx: number
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 */
function dialMetrics(profile: MediaProfile): DialMetrics {
  const wide = profile.width >= WIDE_ENOUGH
  return {
    insetPx: wide ? 28 : 18,
    ringPx: wide ? 168 : 138,
    strokePx: wide ? 12 : 10,
    titlePx: wide ? 13 : 12,
    readoutPx: wide ? 30 : 25,
    statePx: wide ? 13 : 12,
    headingPx: wide ? 15 : 14,
    captionPx: wide ? 14 : 12.5,
    overlayPx: wide ? 260 : 204,
  }
}

/**
 * The colour a tone maps to.
 *
 * @param tone - The meaning, or undefined for the accent.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns A CSS colour.
 */
function toneColour(tone: DialTone | undefined, theme: MediaTheme): string {
  return tone === 'success'
    ? theme.tones.success
    : tone === 'warning'
      ? theme.tones.warning
      : tone === 'danger'
        ? theme.tones.danger
        : theme.accent
}

/**
 * When the last stop of the frame passes.
 *
 * @param config - The frame as the scene configured it.
 * @returns The offset at which nothing is still moving.
 */
function settledAt(config: DialConfig): number {
  let latest = config.overlay?.untilMs ?? 0
  for (const dial of config.dials) {
    for (const stop of dial.stops) {
      latest = max(latest, stop.atMs)
    }
  }
  return latest
}

/**
 * Draw one dial at one instant.
 *
 * @param dial - The countdown.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns Markup for the dial.
 */
function renderDial(dial: Dial, metrics: DialMetrics, theme: MediaTheme, atMs: number): string {
  const value = valueAt({ label: dial.title, max: dial.max, stops: dial.stops }, atMs)
  const fraction = dial.max <= 0 ? 0 : min(1, max(0, value / dial.max))
  const colour = toneColour(dial.tone, theme)
  const radius = metrics.ringPx / 2 - metrics.strokePx
  const circumference = 2 * PI * radius
  const centre = metrics.ringPx / 2
  const readout = `${value.toFixed(dial.decimals ?? 0)}${dial.unit ?? ''}`
  const state = (dial.states ?? []).find((candidate) => atMs >= candidate.atMs && atMs < candidate.untilMs)
  const lastStop = dial.stops.reduce((latest, stop) => max(latest, stop.atMs), 0)
  const under =
    state !== undefined
      ? `<div class="dl-state" style="color:${toneColour(state.tone, theme)}">${escapeHtml(state.label)}</div>`
      : dial.outcome !== undefined && atMs >= lastStop
        ? `<div class="dl-state" style="color:${toneColour(dial.outcomeTone, theme)}">${escapeHtml(dial.outcome)}</div>`
        : '<div class="dl-state"></div>'
  return `<div class="dl-dial">
    <div class="dl-title">${escapeHtml(dial.title)}</div>
    <svg class="dl-ring" viewBox="0 0 ${metrics.ringPx} ${metrics.ringPx}" aria-hidden="true">
      <circle cx="${centre}" cy="${centre}" r="${radius}" fill="none" stroke="${theme.rule}" stroke-width="${metrics.strokePx}"/>
      <circle cx="${centre}" cy="${centre}" r="${radius}" fill="none" stroke="${colour}" stroke-width="${metrics.strokePx}" stroke-linecap="round" stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${(circumference * (1 - fraction)).toFixed(2)}" transform="rotate(-90 ${centre} ${centre})"/>
      <text x="50%" y="50%" dy="0.36em" text-anchor="middle" class="dl-readout" fill="${theme.text.strong}">${escapeHtml(readout)}</text>
    </svg>
    ${under}
  </div>`
}

/**
 * Build the stylesheet for one frame, with its theme resolved into it.
 *
 * @param config - The frame as the scene configured it.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for this frame.
 */
function dialStyles(config: DialConfig, profile: MediaProfile, theme: MediaTheme): string {
  const metrics = dialMetrics(profile)
  return `
.dl-frame { position: absolute; inset: ${metrics.insetPx}px; display: flex; flex-direction: column; gap: ${metrics.insetPx * 0.5}px; }
.dl-heading { flex: none; font-size: ${metrics.headingPx}px; font-weight: 600; letter-spacing: -0.01em; color: ${theme.text.strong}; }
.dl-dials { flex: 1 1 auto; min-height: 0; position: relative; display: flex; justify-content: space-between; align-items: center; padding: 0 ${metrics.insetPx * 2}px; }
.dl-dial { display: flex; flex-direction: column; align-items: center; gap: ${ceil(metrics.titlePx * 0.6)}px; }
.dl-title { font-family: ${theme.fonts.mono}; font-size: ${metrics.titlePx}px; color: ${theme.text.muted}; white-space: nowrap; }
.dl-ring { width: ${metrics.ringPx}px; height: ${metrics.ringPx}px; }
.dl-readout { font-family: ${theme.fonts.mono}; font-size: ${metrics.readoutPx}px; font-weight: 600; letter-spacing: -0.02em; }
.dl-state { min-height: ${ceil(metrics.statePx * 1.4)}px; font-size: ${metrics.statePx}px; font-weight: 600; letter-spacing: 0.02em; }
.dl-overlay {
  position: absolute;
  left: 50%;
  top: 50%;
  width: ${metrics.overlayPx}px;
  padding: ${metrics.insetPx * 0.7}px ${metrics.insetPx * 0.8}px;
  border: 1px solid ${theme.borderActive};
  border-radius: 12px;
  background: ${theme.surfaceRaised};
  box-shadow: ${theme.shadow};
  text-align: center;
}
.dl-overlay-title { font-size: ${metrics.statePx + 2}px; font-weight: 600; color: ${theme.text.strong}; }
.dl-overlay-detail { margin-top: 4px; font-size: ${metrics.statePx - 1}px; color: ${theme.text.muted}; }
.dl-overlay-button { display: inline-block; margin-top: ${ceil(metrics.statePx * 0.8)}px; padding: 5px 12px; border-radius: 999px; background: ${theme.accent}; color: ${theme.transparent ? theme.plate : '#ffffff'}; font-size: ${metrics.statePx - 1}px; font-weight: 600; }
.dl-caption { flex: none; min-height: ${ceil(metrics.captionPx * 1.3)}px; font-size: ${metrics.captionPx}px; color: ${theme.tones.success}; }
`
}

/**
 * Countdowns as rings, and the interruption that tells them apart.
 *
 * A quantity that runs out is a circle emptying, which is the shape every
 * clock has taught a reader to see time in. Two of them side by side, and a
 * card that slides over both for a while, is the whole argument for a timer
 * that can be paused: the ring that keeps draining under the card is the one
 * that will sign the reader out while they are still reading it.
 */
export const dialStage: Stage<DialConfig> = defineStage<DialConfig>({
  id: 'dial',

  styles: dialStyles,

  durationMs(config: DialConfig): number {
    return settledAt(config) + (config.restMs ?? 1200)
  },

  frame({ config, profile, theme, atMs }): string {
    const metrics = dialMetrics(profile)
    const settled = settledAt(config)
    const dials = config.dials.map((dial) => renderDial(dial, metrics, theme, atMs)).join('')

    let overlay = ''
    const card = config.overlay
    if (card !== undefined && atMs >= card.atMs && atMs < card.untilMs + SLIDE_MS) {
      // why: the card slides up as it arrives and down as it leaves, so its presence reads as an event with a beginning and an end rather than a frame that switched
      const entering = min(1, (atMs - card.atMs) / SLIDE_MS)
      const leaving = atMs >= card.untilMs ? min(1, (atMs - card.untilMs) / SLIDE_MS) : 0
      const progress = leaving > 0 ? 1 - leaving : entering
      const eased = 1 - (1 - progress) ** 3
      const style = `transform: translate(-50%, ${(-50 + (1 - eased) * 30).toFixed(1)}%); opacity: ${eased.toFixed(3)};`
      const button = card.action === undefined ? '' : `<span class="dl-overlay-button">${escapeHtml(card.action)}</span>`
      overlay = `<div class="dl-overlay" style="${style}"><div class="dl-overlay-title">${escapeHtml(card.title)}</div><div class="dl-overlay-detail">${escapeHtml(card.detail)}</div>${button}</div>`
    }

    const heading = config.heading === undefined ? '' : `<div class="dl-heading">${escapeHtml(config.heading)}</div>`
    const caption =
      config.caption === undefined
        ? ''
        : `<div class="dl-caption">${atMs >= settled + CAPTION_DELAY_MS ? escapeHtml(config.caption) : ''}</div>`
    return `<div class="dl-frame">${heading}<div class="dl-dials">${dials}${overlay}</div>${caption}</div>`
  },
})
