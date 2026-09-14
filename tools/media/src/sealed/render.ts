import type { SealedConfig } from '../models/sealed'
import type { MediaTheme } from '../models/theme'
import type { Box, Point, SealedLayout, SealedMetrics } from './layout'
import type { MessageSchedule, SealedTimeline } from './timeline'
import { floor, max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { clamp01, easeIn, easeInOut, easeOut, lerp, progress, pulse } from '../lib/motion'
import { CARD_DOTS, cornerRect, jitter, renderEye, renderKey } from './glyphs'
import {
  ABSORB_MS,
  BRIGHTEN_MS,
  CARD_MS,
  COMPARE_MS,
  FADE_MS,
  FALL_MS,
  HELLO_MS,
  PEEL_MS,
  PUSH_MS,
  RISE_MS,
  TRAVEL_MS,
  UNWRAP_MS,
} from './timeline'

/** How bright the listener's copy is while it sits beside the listener. */
const GHOST_OPACITY = 0.4

/** How far the header strip and the tag cap travel to reach the card, in pixels. */
const ATTACH_PX = 26

/** How far a card drifts as it appears, and again as it is absorbed, in pixels. */
const DRIFT_PX = 14

/** How many steps the dots jump through while they scramble. */
const SCRAMBLE_STEPS = 4

/** What the renderer is handed for one instant. */
export interface SealedContext {
  /** The exchange as the scene configured it. */
  config: SealedConfig
  /** Where everything sits. */
  layout: SealedLayout
  /** The measurements this profile is drawn at. */
  metrics: SealedMetrics
  /** The visual tokens this variant is drawn with. */
  theme: MediaTheme
  /** Every moment on the timeline. */
  timeline: SealedTimeline
  /** Offset from the start of the timeline. */
  atMs: number
}

/** One frame, or the card it wraps, at one instant. */
export interface Capsule {
  /** Horizontal centre of the body. */
  cx: number
  /** Vertical centre. */
  cy: number
  /** How far the header strip has slid on, from 0 (absent) to 1 (attached). */
  header: number
  /** How far the dots have scrambled into hatch, from 0 (a plain card) to 1 (sealed). */
  seal: number
  /** How far the tag cap has snapped on, from 0 (absent) to 1 (attached). */
  tag: number
  /** Opacity of the whole capsule. */
  opacity: number
  /** The counter in the header strip. */
  digit: string
  /** How strongly the header is flashing in the danger tone, from 0 to 1. */
  flash: number
  /** Whether the counter has been refused, which keeps the digit in the danger tone. */
  refused: boolean
}

/**
 * Where a moment sits inside a sub-span of a unit progress.
 *
 * @param t - Progress through the whole span, from 0 to 1.
 * @param from - Where the sub-span starts.
 * @param to - Where it ends.
 * @returns Progress through the sub-span, from 0 to 1.
 */
function phase(t: number, from: number, to: number): number {
  return clamp01((t - from) / (to - from))
}

/**
 * A point on a quadratic curve.
 *
 * @param from - Start.
 * @param control - The control point.
 * @param to - End.
 * @param t - Position along the curve from 0 to 1.
 * @returns The point at `t`.
 */
function quadratic(from: Point, control: Point, to: Point, t: number): Point {
  const u = 1 - t
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  }
}

/**
 * Where a message's frame is along the pipe at one instant of its crossing.
 *
 * @param schedule - The message's moments.
 * @param layout - Where everything sits.
 * @param atMs - Offset from the start of the timeline.
 * @returns Horizontal centre of the frame.
 */
function crossingX(schedule: MessageSchedule, layout: SealedLayout, atMs: number): number {
  return lerp(layout.frameStartX, layout.frameEndX, easeInOut(progress(atMs, schedule.travelAt, TRAVEL_MS)))
}

/**
 * The pattern the sealed body is hatched with, and anything else the markup refers to by id.
 *
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup for the `defs` element.
 * @example Placing the definitions at the top of the stage's svg
 * ```ts
 * `<svg>${renderDefs(theme)}...</svg>`
 * ```
 */
export function renderDefs(theme: MediaTheme): string {
  return `<defs><pattern id="sl-hatch" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M -1.5 1.5 L 1.5 -1.5 M 0 6 L 6 0 M 4.5 7.5 L 7.5 4.5" stroke="${theme.accent}" stroke-width="1.6" stroke-linecap="square"/></pattern></defs>`
}

/**
 * Draw the pipe: two rails from the sender to the receiver, and the faint band between them.
 *
 * @param context - The stage at this instant.
 * @returns SVG markup.
 * @example The pipe, drawn before anything that travels it
 * ```ts
 * renderPipe(context)
 * ```
 */
export function renderPipe(context: SealedContext): string {
  const { layout, theme } = context
  const band = `<rect x="${layout.pipeX}" y="${layout.pipeTop}" width="${layout.pipeRight - layout.pipeX}" height="${layout.pipeBottom - layout.pipeTop}" fill="${theme.rule}" opacity="0.45"/>`
  const rail = (y: number): string =>
    `<line x1="${layout.pipeX}" y1="${y}" x2="${layout.pipeRight}" y2="${y}" stroke="${theme.border}" stroke-width="1.5"/>`
  return `${band}${rail(layout.pipeTop)}${rail(layout.pipeBottom)}`
}

/**
 * Draw one end: its node, the key inside it and its name under the key.
 *
 * @param context - The stage at this instant.
 * @param box - Where the node sits.
 * @param name - What the end is called.
 * @param keyedAt - When the other end's hello arrived and this key turned.
 * @param working - How strongly the key is glowing because it is sealing or opening a frame, from 0 to 1.
 * @returns SVG markup.
 * @example The sender, sealing its first frame
 * ```ts
 * renderNode(context, layout.sender, 'page', timeline.senderKeyedAt, pulse(atMs, sealAt, KEY_PULSE_MS))
 * ```
 */
export function renderNode(context: SealedContext, box: Box, name: string, keyedAt: number, working: number): string {
  const { metrics, theme, atMs } = context
  const keyed = easeOut(progress(atMs, keyedAt, FADE_MS))
  const lit = max(pulse(atMs, keyedAt, 800), working)
  const cx = box.x + box.width / 2
  const keyY = box.y + box.height / 2 - 8
  const halo =
    keyed > 0
      ? `<circle cx="${cx}" cy="${keyY}" r="${(metrics.keyPx * 0.58 + 6 * lit).toFixed(1)}" fill="${theme.tones.success}" opacity="${(keyed * (0.14 + 0.3 * lit)).toFixed(3)}"/>`
      : ''
  const faintKey = renderKey({
    cx,
    cy: keyY,
    length: metrics.keyPx,
    direction: 1,
    colour: theme.text.faint,
    hollow: false,
    hole: theme.surface,
  })
  const litKey = renderKey({
    cx,
    cy: keyY,
    length: metrics.keyPx,
    direction: 1,
    colour: theme.tones.success,
    hollow: false,
    hole: theme.surface,
  })
  return `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="${metrics.nodeRadiusPx}" fill="${theme.surface}" stroke="${theme.border}" stroke-width="1.5"/>${halo}<g opacity="${(1 - keyed).toFixed(3)}">${faintKey}</g><g opacity="${keyed.toFixed(3)}">${litKey}</g><text x="${cx}" y="${box.y + box.height - 16}" class="sl-name" text-anchor="middle" dominant-baseline="central">${escapeHtml(name)}</text>`
}

/**
 * Draw a hello crossing the pipe: a hollow key riding one lane, its name riding outside the rail beside it.
 *
 * @param context - The stage at this instant.
 * @param outbound - Whether this is the sender's hello, which rides the upper lane rightward.
 * @returns SVG markup, or nothing while the hello is not in the pipe.
 * @example The sender's hello
 * ```ts
 * renderHello(context, true)
 * ```
 */
export function renderHello(context: SealedContext, outbound: boolean): string {
  const { config, layout, metrics, theme, timeline, atMs } = context
  const t = progress(atMs, outbound ? timeline.helloOutAt : timeline.helloBackAt, HELLO_MS)
  if (t <= 0 || t >= 1) {
    return ''
  }
  const margin = metrics.helloKeyPx / 2 + 6
  const from = outbound ? layout.pipeX + margin : layout.pipeRight - margin
  const to = outbound ? layout.pipeRight - margin : layout.pipeX + margin
  const x = lerp(from, to, easeInOut(t))
  const opacity = easeOut(phase(t, 0, 0.12)) * (1 - easeIn(phase(t, 0.86, 1)))
  const key = renderKey({
    cx: x,
    cy: outbound ? layout.helloOutY : layout.helloBackY,
    length: metrics.helloKeyPx,
    direction: outbound ? 1 : -1,
    colour: theme.accent,
    hollow: true,
    hole: '',
  })
  const labelY = outbound ? layout.helloOutLabelY : layout.helloBackLabelY
  return `<g opacity="${opacity.toFixed(3)}">${key}<text x="${x.toFixed(1)}" y="${labelY}" class="sl-hello" text-anchor="middle" dominant-baseline="central">${escapeHtml(config.hello)}</text></g>`
}

/**
 * Draw one capsule: the card, the header strip, the hatched body and the tag cap, each as far on as it is.
 *
 * @param capsule - The capsule's state.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup.
 * @example A fully sealed frame with counter 1
 * ```ts
 * renderCapsule({ cx: 300, cy: 122, header: 1, seal: 1, tag: 1, opacity: 1, digit: '1', flash: 0, refused: false }, metrics, theme)
 * ```
 */
export function renderCapsule(capsule: Capsule, metrics: SealedMetrics, theme: MediaTheme): string {
  const height = metrics.frameHeightPx
  const radius = height * 0.25
  const top = capsule.cy - height / 2
  const bodyX = capsule.cx - metrics.bodyWidthPx / 2
  const body = cornerRect(bodyX, top, metrics.bodyWidthPx, height, capsule.header > 0 ? 0 : radius, capsule.tag > 0 ? 0 : radius)
  const parts = [`<path d="${body}" fill="${theme.surface}" stroke="${theme.border}" stroke-width="1.5"/>`]
  if (capsule.seal > 0) {
    parts.push(
      `<g opacity="${capsule.seal.toFixed(3)}"><path d="${body}" fill="${theme.accentSoft}"/><path d="${body}" fill="url(#sl-hatch)"/><path d="${body}" fill="none" stroke="${theme.accent}" stroke-width="1.5"/></g>`
    )
  }
  if (capsule.seal < 1) {
    const step = floor(capsule.seal * SCRAMBLE_STEPS)
    for (let index = 0; index < CARD_DOTS; index += 1) {
      // why: a dot mid-scramble jumps to a hashed offset each step, so the card visibly comes apart before the hatch covers it
      const shake = capsule.seal > 0 ? 3 * jitter(index, step) : 0
      const x = capsule.cx + (index - (CARD_DOTS - 1) / 2) * 11 + shake
      parts.push(
        `<circle cx="${x.toFixed(1)}" cy="${capsule.cy}" r="2.2" fill="${theme.text.muted}" opacity="${(1 - capsule.seal).toFixed(3)}"/>`
      )
    }
  }
  if (capsule.header > 0) {
    const x = bodyX - metrics.headerWidthPx - ATTACH_PX * (1 - capsule.header)
    const strip = cornerRect(x, top, metrics.headerWidthPx, height, radius, 0)
    const flash =
      capsule.flash > 0 ? `<path d="${strip}" fill="${theme.tones.danger}" opacity="${(0.55 * capsule.flash).toFixed(3)}"/>` : ''
    const digitColour = capsule.refused ? theme.tones.danger : theme.text.strong
    parts.push(
      `<g opacity="${capsule.header.toFixed(3)}"><path d="${strip}" fill="${theme.surfaceRaised}" stroke="${theme.border}" stroke-width="1.5"/>${flash}<text x="${(x + metrics.headerWidthPx / 2).toFixed(1)}" y="${capsule.cy}" class="sl-digit" fill="${digitColour}" text-anchor="middle" dominant-baseline="central">${escapeHtml(capsule.digit)}</text></g>`
    )
  }
  if (capsule.tag > 0) {
    const x = bodyX + metrics.bodyWidthPx + ATTACH_PX * (1 - capsule.tag)
    parts.push(
      `<g opacity="${capsule.tag.toFixed(3)}"><path d="${cornerRect(x, top, metrics.tagWidthPx, height, 0, radius)}" fill="${theme.tones.warning}"/><circle cx="${(x + metrics.tagWidthPx / 2).toFixed(1)}" cy="${capsule.cy}" r="2.2" fill="${theme.surface}"/></g>`
    )
  }
  return `<g opacity="${capsule.opacity.toFixed(3)}">${parts.join('')}</g>`
}

/**
 * Work out where one message stands: a card appearing, a frame being wrapped, crossing, unwrapping, or absorbed.
 *
 * @param context - The stage at this instant.
 * @param schedule - The message's moments.
 * @param digit - The counter it is numbered with.
 * @returns The capsule to draw, or undefined before the card appears and after it is absorbed.
 * @example The first message at three seconds
 * ```ts
 * messageCapsule(context, timeline.messages[0], '1')
 * ```
 */
export function messageCapsule(context: SealedContext, schedule: MessageSchedule, digit: string): Capsule | undefined {
  const { layout, atMs } = context
  if (atMs < schedule.cardAt || atMs >= schedule.doneAt) {
    return undefined
  }
  const appear = easeOut(progress(atMs, schedule.cardAt, CARD_MS))
  let cx = layout.frameStartX - DRIFT_PX * (1 - appear)
  let opacity = appear
  let header = easeOut(progress(atMs, schedule.wrapAt, schedule.headerMs))
  let seal = progress(atMs, schedule.sealAt, schedule.sealMs)
  let tag = easeOut(progress(atMs, schedule.tagAt, schedule.tagMs))
  if (atMs >= schedule.travelAt) {
    cx = crossingX(schedule, layout, atMs)
  }
  if (atMs >= schedule.unwrapAt) {
    const u = progress(atMs, schedule.unwrapAt, UNWRAP_MS)
    tag = 1 - easeOut(phase(u, 0, 0.4))
    seal = 1 - phase(u, 0.2, 0.75)
    header = 1 - easeOut(phase(u, 0.45, 1))
  }
  if (atMs >= schedule.absorbAt) {
    const absorbed = easeIn(progress(atMs, schedule.absorbAt, ABSORB_MS))
    cx = layout.frameEndX + DRIFT_PX * 3 * absorbed
    opacity = 1 - absorbed
  }
  return { cx, cy: layout.pipeY, header, seal, tag, opacity, digit, flash: 0, refused: false }
}

/**
 * Work out where the listener's copy stands: peeling off, parked, rising back in, pushed, stopped, falling, or landed.
 *
 * @param context - The stage at this instant.
 * @returns The capsule to draw, or undefined before the copy is taken.
 * @example The copy at the moment it is refused
 * ```ts
 * ghostCapsule({ ...context, atMs: timeline.compareAt })
 * ```
 */
export function ghostCapsule(context: SealedContext): Capsule | undefined {
  const { config, layout, timeline, atMs } = context
  const last = timeline.messages[timeline.messages.length - 1]
  if (last === undefined || atMs < timeline.peelAt) {
    return undefined
  }
  const start = { x: crossingX(last, layout, timeline.peelAt), y: layout.pipeY }
  const peeled = easeOut(progress(atMs, timeline.peelAt, PEEL_MS))
  let position = { x: lerp(start.x, layout.parked.x, peeled), y: lerp(start.y, layout.parked.y, peeled) }
  if (atMs >= timeline.riseAt) {
    position = quadratic(layout.parked, layout.riseControl, layout.risen, easeInOut(progress(atMs, timeline.riseAt, RISE_MS)))
  }
  if (atMs >= timeline.pushAt) {
    position = { x: lerp(layout.risen.x, layout.frameEndX, easeInOut(progress(atMs, timeline.pushAt, PUSH_MS))), y: layout.pipeY }
  }
  if (atMs >= timeline.fallAt) {
    position = quadratic(
      { x: layout.frameEndX, y: layout.pipeY },
      layout.fallControl,
      layout.landing,
      easeIn(progress(atMs, timeline.fallAt, FALL_MS))
    )
  }
  return {
    cx: position.x,
    cy: position.y,
    header: 1,
    seal: 1,
    tag: 1,
    opacity: lerp(GHOST_OPACITY, 1, easeOut(progress(atMs, timeline.replayAt, BRIGHTEN_MS))),
    digit: `${config.messages}`,
    flash: pulse(atMs, timeline.compareAt, COMPARE_MS),
    refused: atMs >= timeline.compareAt,
  }
}

/**
 * Draw the listener under the pipe, lit from the moment it copies until its copy has left it.
 *
 * @param context - The stage at this instant.
 * @returns SVG markup.
 * @example The listener, drawn before the copy so the copy sits over it
 * ```ts
 * renderListener(context)
 * ```
 */
export function renderListener(context: SealedContext): string {
  const { layout, metrics, theme, timeline, atMs } = context
  let lit = 0
  if (atMs >= timeline.risenAt) {
    lit = 1 - easeIn(progress(atMs, timeline.risenAt + 200, FADE_MS))
  } else if (atMs >= timeline.copyAt) {
    lit = easeOut(progress(atMs, timeline.copyAt, FADE_MS))
  }
  const faint = renderEye(layout.listener.x, layout.listener.y, metrics.eyePx, theme.text.faint, 0)
  const warm = renderEye(layout.listener.x, layout.listener.y, metrics.eyePx, theme.tones.warning, 1)
  return `<g opacity="${(1 - lit).toFixed(3)}">${faint}</g><g opacity="${lit.toFixed(3)}">${warm}</g>`
}

/**
 * Draw the tray a refused frame lands in, and the code written beside it once it has.
 *
 * @param context - The stage at this instant.
 * @returns SVG markup.
 * @example The tray, drawn before the copy so the copy lands in it
 * ```ts
 * renderTray(context)
 * ```
 */
export function renderTray(context: SealedContext): string {
  const { config, layout, theme, timeline, atMs } = context
  const { tray } = layout
  const radius = 8
  const rim = `M ${tray.x} ${tray.y} V ${tray.y + tray.height - radius} A ${radius} ${radius} 0 0 0 ${tray.x + radius} ${tray.y + tray.height} H ${tray.x + tray.width - radius} A ${radius} ${radius} 0 0 0 ${tray.x + tray.width} ${tray.y + tray.height - radius} V ${tray.y}`
  const code = easeOut(progress(atMs, timeline.codeAt, FADE_MS))
  const label =
    code > 0
      ? `<text x="${layout.codeX}" y="${layout.landing.y}" class="sl-code" text-anchor="end" dominant-baseline="central" opacity="${code.toFixed(3)}">${escapeHtml(config.replayCode)}</text>`
      : ''
  return `<path d="${rim}" fill="${theme.surfaceRaised}" opacity="0.85"/><path d="${rim}" fill="none" stroke="${theme.border}" stroke-width="1.5"/>${label}`
}

/**
 * Draw the comparison the receiver makes when it refuses the copy: the counter is not above the last one accepted.
 *
 * @param context - The stage at this instant.
 * @returns SVG markup, or nothing outside the moment.
 * @example The comparison at the moment of refusal
 * ```ts
 * renderCompare({ ...context, atMs: timeline.compareAt + 200 })
 * ```
 */
export function renderCompare(context: SealedContext): string {
  const { config, layout, timeline, atMs } = context
  const opacity = easeOut(progress(atMs, timeline.compareAt, 150)) * (1 - easeIn(progress(atMs, timeline.fallAt, 200)))
  if (opacity <= 0) {
    return ''
  }
  return `<text x="${layout.frameEndX}" y="${layout.compareY}" class="sl-compare" text-anchor="middle" dominant-baseline="central" opacity="${opacity.toFixed(3)}">&#8804; ${config.messages}</text>`
}
