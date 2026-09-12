import type { MediaTheme } from '../models/theme'
import type { LanesMetrics } from './layout'
import type { ValueKind } from './timeline'
import { cos, max, PI, sin } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { escapeHtml } from '../lib/escape-html'
import { easeIn, easeOut, lerp } from '../lib/motion'

/** The angle the gate bar rests at when open, in degrees: swung up out of the lane. */
const GATE_OPEN_DEG = -70

/** How far each side of the shield's arcs reach from the horizontal, in degrees; the rest is the gap a token passes through. */
const SHIELD_HALF_DEG = 62

/** The directions the strokes of a throw radiate in, in degrees, none of them straight up or down. */
const BURST_DEGREES: readonly number[] = [0, 60, 120, 180, 240, 300]

/** How long a burst stroke is, from head to tail. */
const BURST_TAIL_PX = 14

/** How a token is coloured. */
export type TokenLook = 'plain' | 'danger' | 'faint' | 'accent'

/** Where and how a token is drawn at one instant. */
export interface TokenPose {
  /** Horizontal centre. */
  x: number
  /** Vertical centre. */
  y: number
  /** Horizontal scale. */
  sx: number
  /** Vertical scale. */
  sy: number
  /** Opacity from 0 to 1. */
  opacity: number
  /** The text on the token. */
  label: string
  /** How the token is coloured. */
  look: TokenLook
}

/**
 * Draw one token.
 *
 * @param pose - Where and how the token is.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup, or nothing for a token that cannot be seen.
 * @example A token resting on the box in the plain look
 * ```ts
 * renderToken({ x: 108, y: 162, sx: 1, sy: 1, opacity: 1, label: '1', look: 'plain' }, metrics, theme)
 * ```
 */
export function renderToken(pose: TokenPose, metrics: LanesMetrics, theme: MediaTheme): string {
  if (pose.opacity <= 0 || pose.sx <= 0 || pose.sy <= 0) {
    return ''
  }
  const fill = pose.look === 'faint' ? theme.surface : theme.surfaceRaised
  const stroke =
    pose.look === 'danger'
      ? theme.tones.danger
      : pose.look === 'accent'
        ? theme.accent
        : pose.look === 'faint'
          ? theme.rule
          : theme.text.muted
  const colour =
    pose.look === 'danger'
      ? theme.tones.danger
      : pose.look === 'accent'
        ? theme.tones.accent
        : pose.look === 'faint'
          ? theme.text.faint
          : theme.text.strong
  return `<g transform="translate(${pose.x.toFixed(1)} ${pose.y.toFixed(1)}) scale(${pose.sx.toFixed(3)} ${pose.sy.toFixed(3)})" opacity="${pose.opacity.toFixed(3)}"><circle r="${metrics.tokenRPx}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><text class="ln-mono ln-token" fill="${colour}" text-anchor="middle" dominant-baseline="central">${escapeHtml(pose.label)}</text></g>`
}

/**
 * Draw the function box, glowing in a tone when a call has just reached it.
 *
 * @param cx - Horizontal centre of the lane.
 * @param label - The function's name.
 * @param flash - How strongly the box glows, from 0 to 1.
 * @param tone - What the box glows in.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup.
 * @example The box at rest
 * ```ts
 * renderBox(108, 'send', 0, theme.tones.success, metrics, theme)
 * ```
 */
export function renderBox(cx: number, label: string, flash: number, tone: string, metrics: LanesMetrics, theme: MediaTheme): string {
  const x = cx - metrics.boxWPx / 2
  const y = metrics.boxYPx - metrics.boxHPx / 2
  const halo =
    flash > 0
      ? `<rect x="${(x - 4 - 6 * flash).toFixed(1)}" y="${(y - 4 - 6 * flash).toFixed(1)}" width="${(metrics.boxWPx + 8 + 12 * flash).toFixed(1)}" height="${(metrics.boxHPx + 8 + 12 * flash).toFixed(1)}" rx="12" fill="none" stroke="${tone}" stroke-width="1.5" opacity="${(0.55 * flash).toFixed(3)}"/>`
      : ''
  const tint =
    flash > 0
      ? `<rect x="${x}" y="${y}" width="${metrics.boxWPx}" height="${metrics.boxHPx}" rx="8" fill="${tone}" opacity="${(0.22 * flash).toFixed(3)}"/>`
      : ''
  const stroke = flash > 0 ? tone : theme.border
  return `${halo}<rect x="${x}" y="${y}" width="${metrics.boxWPx}" height="${metrics.boxHPx}" rx="8" fill="${theme.surface}" stroke="${stroke}" stroke-width="${(1.5 + 1.2 * flash).toFixed(2)}"/>${tint}<text class="ln-mono ln-box" x="${cx}" y="${metrics.boxYPx}" text-anchor="middle" dominant-baseline="central">${escapeHtml(label)}</text>`
}

/**
 * Draw the ring round the box: dashed while it holds nothing, solid once it is a cache.
 *
 * @param cx - Horizontal centre of the lane.
 * @param solid - How far the ring has become a cache, from 0 to 1.
 * @param blip - How strongly the ring lights where a token has just touched it, from 0 to 1.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup.
 * @example The empty ring
 * ```ts
 * renderRing(234, 0, 0, metrics, theme)
 * ```
 */
export function renderRing(cx: number, solid: number, blip: number, metrics: LanesMetrics, theme: MediaTheme): string {
  const cy = metrics.boxYPx
  const r = metrics.ringRPx
  const dashed = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${theme.accent}" stroke-width="1.5" stroke-dasharray="4 5" opacity="${(0.55 * (1 - solid)).toFixed(3)}"/>`
  const full =
    solid > 0
      ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${theme.accentSoft}" stroke="${theme.accent}" stroke-width="2" opacity="${solid.toFixed(3)}"/>`
      : ''
  const glow =
    blip > 0
      ? `<circle cx="${cx}" cy="${cy - r}" r="${(metrics.tokenRPx + 6 * blip).toFixed(1)}" fill="${theme.accent}" opacity="${(0.35 * blip).toFixed(3)}"/>`
      : ''
  return `${dashed}${full}${glow}`
}

/**
 * Draw the badge that shows what the cache holds.
 *
 * @param x - Horizontal centre.
 * @param y - Vertical centre.
 * @param scale - Size from 0 (nothing) to 1 (full).
 * @param glow - How strongly the badge lights as a token takes its value, from 0 to 1.
 * @param text - The stored value.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup, or nothing before the badge appears.
 * @example The badge at full size, holding the first result
 * ```ts
 * renderBadge(264, 164, 1, 0, '1', metrics, theme)
 * ```
 */
export function renderBadge(
  x: number,
  y: number,
  scale: number,
  glow: number,
  text: string,
  metrics: LanesMetrics,
  theme: MediaTheme
): string {
  if (scale <= 0) {
    return ''
  }
  const halo =
    glow > 0 ? `<circle r="${(metrics.badgeRPx + 5 * glow).toFixed(1)}" fill="${theme.accent}" opacity="${(0.4 * glow).toFixed(3)}"/>` : ''
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(3)})" opacity="${scale.toFixed(3)}">${halo}<circle r="${metrics.badgeRPx}" fill="${theme.surfaceRaised}" stroke="${theme.accent}" stroke-width="2"/><text class="ln-mono ln-badge" text-anchor="middle" dominant-baseline="central">${escapeHtml(text)}</text></g>`
}

/**
 * Draw the gate: a bar on a hinge, swung up while the switch is on and laid across the lane while it is off.
 *
 * @param cx - Horizontal centre of the lane.
 * @param shut - How far shut the gate is, from 0 (open) to 1 (across the lane).
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup.
 * @example The gate open
 * ```ts
 * renderGate(390, 0, metrics, theme)
 * ```
 */
export function renderGate(cx: number, shut: number, metrics: LanesMetrics, theme: MediaTheme): string {
  const hx = cx - metrics.gateHingePx
  const y = metrics.gateYPx
  const angle = lerp(GATE_OPEN_DEG, 0, shut)
  const bar = (colour: string, opacity: number): string =>
    opacity <= 0
      ? ''
      : `<line x1="0" y1="0" x2="${metrics.gateLenPx}" y2="0" stroke="${colour}" stroke-width="3.5" stroke-linecap="round" opacity="${opacity.toFixed(3)}"/>`
  // why: the post the bar lands on is what makes a lifted bar read as a gate rather than a stray line
  const postX = hx + metrics.gateLenPx - 3
  const post = `<line x1="${postX.toFixed(1)}" y1="${y + 2}" x2="${postX.toFixed(1)}" y2="${y + 12}" stroke="${theme.text.muted}" stroke-width="3" stroke-linecap="round"/>`
  return `${post}<g transform="translate(${hx.toFixed(1)} ${y}) rotate(${angle.toFixed(2)})">${bar(theme.tones.success, 1 - shut)}${bar(theme.tones.warning, shut)}</g><circle cx="${hx.toFixed(1)}" cy="${y}" r="4.5" fill="${shut > 0.5 ? theme.tones.warning : theme.tones.success}"/><circle cx="${hx.toFixed(1)}" cy="${y}" r="1.8" fill="${theme.surface}"/>`
}

/**
 * The `d` of one arc of the shield, from one angle to another round the box.
 *
 * @param cx - Horizontal centre.
 * @param cy - Vertical centre.
 * @param r - Radius.
 * @param fromDeg - Where the arc starts, in degrees clockwise from the right.
 * @param toDeg - Where it ends.
 * @returns A path `d` attribute.
 */
function arcPath(cx: number, cy: number, r: number, fromDeg: number, toDeg: number): string {
  const a0 = (fromDeg * PI) / 180
  const a1 = (toDeg * PI) / 180
  return `M ${(cx + r * cos(a0)).toFixed(1)} ${(cy + r * sin(a0)).toFixed(1)} A ${r} ${r} 0 0 1 ${(cx + r * cos(a1)).toFixed(1)} ${(cy + r * sin(a1)).toFixed(1)}`
}

/**
 * Draw the shield: two arcs either side of the box, open above and below so a token passes through.
 *
 * @param cx - Horizontal centre of the lane.
 * @param glow - How strongly the shield lights as it holds a throw in, from 0 to 1.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup.
 * @example The shield at rest
 * ```ts
 * renderShield(546, 0, metrics, theme)
 * ```
 */
export function renderShield(cx: number, glow: number, metrics: LanesMetrics, theme: MediaTheme): string {
  const cy = metrics.boxYPx
  const r = metrics.shieldRPx
  const right = arcPath(cx, cy, r, -SHIELD_HALF_DEG, SHIELD_HALF_DEG)
  const left = arcPath(cx, cy, r, 180 - SHIELD_HALF_DEG, 180 + SHIELD_HALF_DEG)
  const halo =
    glow > 0
      ? `<path d="${right}" fill="none" stroke="${theme.accent}" stroke-width="${(6 + 6 * glow).toFixed(1)}" stroke-linecap="round" opacity="${(0.35 * glow).toFixed(3)}"/><path d="${left}" fill="none" stroke="${theme.accent}" stroke-width="${(6 + 6 * glow).toFixed(1)}" stroke-linecap="round" opacity="${(0.35 * glow).toFixed(3)}"/>`
      : ''
  const width = (3 + 1.5 * glow).toFixed(2)
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${theme.accentSoft}"/>${halo}<path d="${right}" fill="none" stroke="${theme.accent}" stroke-width="${width}" stroke-linecap="round"/><path d="${left}" fill="none" stroke="${theme.accent}" stroke-width="${width}" stroke-linecap="round"/>`
}

/**
 * Draw the strokes of a throw radiating from the box.
 *
 * @param cx - Horizontal centre of the lane.
 * @param t - Progress of the burst from 0 to 1.
 * @param reach - How far from the box's centre the strokes get before they stop.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup, or nothing outside the burst.
 * @example A burst half way out in the plain lane
 * ```ts
 * renderBurst(108, 0.5, metrics.burstReachPx, metrics, theme)
 * ```
 */
export function renderBurst(cx: number, t: number, reach: number, metrics: LanesMetrics, theme: MediaTheme): string {
  if (t <= 0 || t >= 1) {
    return ''
  }
  const from = metrics.boxHPx / 2 + 4
  const head = lerp(from, reach, easeOut(t))
  const tail = max(from, head - BURST_TAIL_PX)
  const opacity = 1 - easeIn(t)
  const strokes = BURST_DEGREES.map((degrees) => {
    const angle = (degrees * PI) / 180
    const x1 = cx + tail * cos(angle)
    const y1 = metrics.boxYPx + tail * sin(angle)
    const x2 = cx + head * cos(angle)
    const y2 = metrics.boxYPx + head * sin(angle)
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`
  })
  return `<g stroke="${theme.tones.danger}" stroke-width="2.5" stroke-linecap="round" opacity="${opacity.toFixed(3)}">${strokes.join('')}</g>`
}

/**
 * Draw the bar that seals a lane once a throw has ended it, growing out from the middle.
 *
 * @param cx - Horizontal centre of the lane.
 * @param t - How far the bar has drawn, from 0 to 1.
 * @param halfWidth - Half the bar's full length.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup, or nothing before the bar starts.
 * @example The bar fully drawn
 * ```ts
 * renderBar(108, 1, 40, metrics, theme)
 * ```
 */
export function renderBar(cx: number, t: number, halfWidth: number, metrics: LanesMetrics, theme: MediaTheme): string {
  if (t <= 0) {
    return ''
  }
  const half = halfWidth * t
  const y = metrics.gateYPx
  return `<line x1="${(cx - half).toFixed(1)}" y1="${y}" x2="${(cx + half).toFixed(1)}" y2="${y}" stroke="${theme.tones.danger}" stroke-width="3.5" stroke-linecap="round"/><line x1="${(cx - half).toFixed(1)}" y1="${y - 5}" x2="${(cx - half).toFixed(1)}" y2="${y + 5}" stroke="${theme.tones.danger}" stroke-width="2.5" stroke-linecap="round" opacity="${t.toFixed(3)}"/><line x1="${(cx + half).toFixed(1)}" y1="${y - 5}" x2="${(cx + half).toFixed(1)}" y2="${y + 5}" stroke="${theme.tones.danger}" stroke-width="2.5" stroke-linecap="round" opacity="${t.toFixed(3)}"/>`
}

/**
 * Draw the tray a lane's results collect in.
 *
 * @param cx - Horizontal centre of the lane.
 * @param width - How wide the tray is drawn, edge to edge.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup.
 * @example A wrapped lane's tray
 * ```ts
 * renderTray(234, 116, metrics, theme)
 * ```
 */
export function renderTray(cx: number, width: number, metrics: LanesMetrics, theme: MediaTheme): string {
  const l = cx - width / 2
  const r = cx + width / 2
  const top = metrics.trayTopPx
  const bottom = metrics.trayBottomPx
  const d = `M ${l.toFixed(1)} ${top} V ${bottom - 7} Q ${l.toFixed(1)} ${bottom} ${(l + 7).toFixed(1)} ${bottom} H ${(r - 7).toFixed(1)} Q ${r.toFixed(1)} ${bottom} ${r.toFixed(1)} ${bottom - 7} V ${top}`
  return `<path d="${d}" fill="${theme.surface}" stroke="${theme.border}" stroke-width="1.5" stroke-linejoin="round"/>`
}

/**
 * Draw one value in the tray.
 *
 * @param x - Horizontal centre of its slot.
 * @param kind - What kind of value it is, which decides its shape and tone.
 * @param text - Its text, for a kind that is text.
 * @param opacity - How far it has faded in, from 0 to 1.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup, or nothing before it starts to appear.
 * @example The first result, fully in
 * ```ts
 * renderValue(194, 'arg', '1', 1, metrics, theme)
 * ```
 */
export function renderValue(x: number, kind: ValueKind, text: string, opacity: number, metrics: LanesMetrics, theme: MediaTheme): string {
  if (opacity <= 0) {
    return ''
  }
  const y = metrics.trayYPx + 4 * (1 - opacity)
  const open = `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" opacity="${opacity.toFixed(3)}">`
  if (kind === 'arg' || kind === 'cached') {
    const colour = kind === 'arg' ? theme.tones.success : theme.tones.accent
    return `${open}<text class="ln-mono ln-value" fill="${colour}" text-anchor="middle" dominant-baseline="central">${escapeHtml(text)}</text></g>`
  }
  if (kind === 'undefined') {
    return `${open}<text class="ln-mono ln-value--small" fill="${theme.text.muted}" text-anchor="middle" dominant-baseline="central">${escapeHtml(text)}</text></g>`
  }
  if (kind === 'dash') {
    return `${open}<line x1="-6" y1="0" x2="6" y2="0" stroke="${theme.text.faint}" stroke-width="2.4" stroke-linecap="round"/></g>`
  }
  if (kind === 'cross') {
    return `${open}<path d="M -5 -5 L 5 5 M 5 -5 L -5 5" stroke="${theme.tones.danger}" stroke-width="2.6" stroke-linecap="round" fill="none"/></g>`
  }
  const colour = kind === 'check' ? theme.tones.success : theme.tones.warning
  const slash =
    kind === 'slashed' ? `<path d="M -1.5 -4 L 5.5 3" stroke="${colour}" stroke-width="2.2" stroke-linecap="round" fill="none"/>` : ''
  return `${open}<path d="M -7 0.5 L -2 5.5 L 7 -5.5" stroke="${colour}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>${slash}</g>`
}

/**
 * Draw the switch in the margin: a pill with a knob that slides down as it goes off, and its name under it.
 *
 * @param x - Horizontal centre.
 * @param off - How far off the switch is, from 0 (on) to 1 (off).
 * @param label - The switch's name.
 * @param metrics - The measurements this profile is drawn at.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns SVG markup.
 * @example The switch on
 * ```ts
 * renderToggle(39, 0, 'online', metrics, theme)
 * ```
 */
export function renderToggle(x: number, off: number, label: string, metrics: LanesMetrics, theme: MediaTheme): string {
  const y = metrics.gateYPx
  const w = metrics.pillWPx
  const h = metrics.pillHPx
  const left = x - w / 2
  const top = y - h / 2
  const knobR = w / 2 - 3
  const travel = h / 2 - w / 2
  const knobY = y + lerp(-travel, travel, off)
  const pill = (colour: string, opacity: number): string =>
    opacity <= 0
      ? ''
      : `<rect x="${left}" y="${top}" width="${w}" height="${h}" rx="${w / 2}" fill="${colour}" opacity="${opacity.toFixed(3)}"/>`
  const labelColour = off > 0.5 ? theme.text.faint : theme.text.muted
  return `${pill(theme.tones.success, 1 - off)}${pill(theme.text.faint, off)}<circle cx="${x}" cy="${knobY.toFixed(1)}" r="${knobR}" fill="${theme.surface}"/><text class="ln-mono ln-small" x="${x}" y="${y + h / 2 + metrics.smallPx * 1.3}" fill="${labelColour}" text-anchor="middle" dominant-baseline="central">${escapeHtml(label)}</text>`
}
