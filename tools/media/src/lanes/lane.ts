import type { LanesConfig } from '../models/lanes'
import type { MediaTheme } from '../models/theme'
import type { LaneGeometry, LanesLayout, LanesMetrics } from './layout'
import type { TokenPose } from './render'
import type { CallPlan, LanePlan } from './timeline'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { easeIn, easeInOut, easeOut, lerp, progress, pulse } from '../lib/motion'
import { alongArc } from './layout'
import {
  renderBadge,
  renderBar,
  renderBox,
  renderBurst,
  renderGate,
  renderRing,
  renderShield,
  renderToken,
  renderTray,
  renderValue,
} from './render'
import {
  ARC_DROP_MS,
  BAR_MS,
  BURST_MS,
  BYPASS_MS,
  CACHE_MS,
  DIVE_MS,
  DROP_MS,
  EMERGE_MS,
  FADE_MS,
  FLASH_MS,
  LAND_MS,
  SHIELD_MS,
  SQUASH_MS,
  VALUE_MS,
} from './timeline'

/** How long a token takes to scale in where it appears. */
const APPEAR_MS = 150

/** How far a token sinks into the box, and rises out of it, in pixels. */
const DIVE_PX = 14

/** How long the ring lights where a token has touched it. */
const BLIP_MS = 300

/** How long the badge lights as a token takes its value. */
const STAMP_MS = 400

/** What the renderer is handed for one lane at one instant. */
export interface LaneInstant {
  /** The lanes as the scene configured them. */
  config: LanesConfig
  /** Where everything sits. */
  layout: LanesLayout
  /** The measurements this profile is drawn at. */
  metrics: LanesMetrics
  /** The visual tokens this variant is drawn with. */
  theme: MediaTheme
  /** Where this lane sits. */
  geometry: LaneGeometry
  /** What becomes of every call in this lane. */
  plan: LanePlan
  /** How far shut the gate is, from 0 to 1, for a lane that has one. */
  shut: number
  /** Offset from the start of the timeline. */
  atMs: number
}

/** How strongly the box glows, and in what. */
interface BoxFlash {
  /** Strength from 0 to 1. */
  strength: number
  /** The tone. */
  tone: string
}

/**
 * Where a token is once it has come out of the bottom of the box and is on its way to the tray.
 *
 * @param plan - The call being drawn.
 * @param fromY - Vertical centre the token drops from.
 * @param cx - Horizontal centre of the lane.
 * @param slotX - Horizontal centre of the token's slot in the tray.
 * @param dropAt - When the drop starts.
 * @param dropMs - How long the drop takes.
 * @param metrics - The measurements this profile is drawn at.
 * @param atMs - Offset from the start of the timeline.
 * @returns The pose, or undefined once the token has become its value.
 */
function dropPose(
  plan: CallPlan,
  fromY: number,
  cx: number,
  slotX: number,
  dropAt: number,
  dropMs: number,
  metrics: LanesMetrics,
  atMs: number
): TokenPose | undefined {
  const drop = easeInOut(progress(atMs, dropAt, dropMs))
  const land = progress(atMs, plan.valueAt, LAND_MS)
  if (land >= 1) {
    return undefined
  }
  const look = plan.fate === 'cached' ? 'accent' : 'plain'
  const label = plan.fate === 'cached' ? plan.valueText : plan.arg
  const scale = 1 - 0.3 * land
  return { x: lerp(cx, slotX, drop), y: lerp(fromY, metrics.trayYPx, drop), sx: scale, sy: scale, opacity: 1 - land, label, look }
}

/**
 * Where a token that reached the box is, from its landing through the box to the tray.
 *
 * @param plan - The call being drawn.
 * @param cx - Horizontal centre of the lane.
 * @param slotX - Horizontal centre of the token's slot in the tray.
 * @param metrics - The measurements this profile is drawn at.
 * @param atMs - Offset from the start of the timeline.
 * @returns The pose, or undefined while the token is inside the box or once it has become its value.
 */
function throughPose(plan: CallPlan, cx: number, slotX: number, metrics: LanesMetrics, atMs: number): TokenPose | undefined {
  const diveAt = plan.arriveAt + SQUASH_MS
  if (atMs < plan.emergeAt) {
    const dive = easeIn(progress(atMs, diveAt, DIVE_MS))
    if (dive >= 1) {
      return undefined
    }
    const squash = pulse(atMs, plan.arriveAt, SQUASH_MS)
    const scale = 1 - 0.65 * dive
    return {
      x: cx,
      y: plan.stopY + DIVE_PX * dive,
      sx: scale * (1 + 0.14 * squash),
      sy: scale * (1 - 0.18 * squash),
      opacity: 1 - dive,
      label: plan.arg,
      look: 'plain',
    }
  }
  const emergeY = metrics.boxYPx + metrics.boxHPx / 2 + metrics.tokenRPx + 1
  const emerge = easeOut(progress(atMs, plan.emergeAt, EMERGE_MS))
  if (emerge < 1) {
    const scale = lerp(0.35, 1, emerge)
    return { x: cx, y: emergeY - DIVE_PX * (1 - emerge), sx: scale, sy: scale, opacity: emerge, label: plan.arg, look: 'plain' }
  }
  return dropPose(plan, emergeY, cx, slotX, plan.emergeAt + EMERGE_MS, DROP_MS, metrics, atMs)
}

/**
 * Where a token that the cache turned away is, riding the arc round the box to the tray.
 *
 * @param plan - The call being drawn.
 * @param cx - Horizontal centre of the lane.
 * @param slotX - Horizontal centre of the token's slot in the tray.
 * @param layout - Where everything sits.
 * @param metrics - The measurements this profile is drawn at.
 * @param atMs - Offset from the start of the timeline.
 * @returns The pose, or undefined once the token has become its value.
 */
function bypassPose(
  plan: CallPlan,
  cx: number,
  slotX: number,
  layout: LanesLayout,
  metrics: LanesMetrics,
  atMs: number
): TokenPose | undefined {
  const bypassAt = plan.arriveAt + SQUASH_MS
  const stamped = atMs >= plan.swapAt
  const label = stamped ? plan.valueText : plan.arg
  const look = stamped ? 'accent' : 'plain'
  if (atMs < bypassAt + BYPASS_MS) {
    const touch = pulse(atMs, plan.arriveAt, SQUASH_MS)
    const point = alongArc(layout.arcR, easeInOut(progress(atMs, bypassAt, BYPASS_MS)))
    return { x: cx + point.dx, y: metrics.boxYPx + point.dy, sx: 1 + 0.1 * touch, sy: 1 - 0.12 * touch, opacity: 1, label, look }
  }
  return dropPose(plan, metrics.boxYPx + layout.arcR, cx, slotX, bypassAt + BYPASS_MS, ARC_DROP_MS, metrics, atMs)
}

/**
 * Where one call's token is, and how it looks, at one instant.
 *
 * @param plan - The call being drawn.
 * @param cx - Horizontal centre of the lane.
 * @param slotX - Horizontal centre of the token's slot in the tray.
 * @param layout - Where everything sits.
 * @param metrics - The measurements this profile is drawn at.
 * @param atMs - Offset from the start of the timeline.
 * @returns The pose, or undefined while there is no token to draw.
 * @example The first call's token a third of a second after it appeared
 * ```ts
 * tokenPose(plan, 108, 72, layout, metrics, 933)
 * ```
 */
export function tokenPose(
  plan: CallPlan,
  cx: number,
  slotX: number,
  layout: LanesLayout,
  metrics: LanesMetrics,
  atMs: number
): TokenPose | undefined {
  if (atMs < plan.dropAt) {
    return undefined
  }
  if (atMs < plan.arriveAt) {
    const appear = easeOut(progress(atMs, plan.dropAt, APPEAR_MS))
    const fall = easeIn(progress(atMs, plan.dropAt, plan.fallMs))
    return { x: cx, y: lerp(metrics.spawnYPx, plan.stopY, fall), sx: appear, sy: appear, opacity: appear, label: plan.arg, look: 'plain' }
  }
  if (plan.fate === 'pass' || plan.fate === 'absorb') {
    return throughPose(plan, cx, slotX, metrics, atMs)
  }
  if (plan.fate === 'cached') {
    return bypassPose(plan, cx, slotX, layout, metrics, atMs)
  }
  if (plan.fate === 'skip') {
    const press = easeOut(progress(atMs, plan.arriveAt, SQUASH_MS))
    const fade = easeIn(progress(atMs, plan.arriveAt + SQUASH_MS, FADE_MS))
    if (fade >= 1) {
      return undefined
    }
    // why: the token flattens against the bar rather than into itself, so its bottom edge stays on the gate
    return {
      x: cx,
      y: plan.stopY + metrics.tokenRPx * 0.3 * press,
      sx: 1 + 0.1 * press,
      sy: 1 - 0.3 * press,
      opacity: 1 - fade,
      label: plan.arg,
      look: 'plain',
    }
  }
  const squash = pulse(atMs, plan.arriveAt, SQUASH_MS)
  const settled = atMs >= plan.arriveAt + SQUASH_MS / 2
  const look = settled ? (plan.fate === 'throw' ? 'danger' : 'faint') : 'plain'
  return { x: cx, y: plan.stopY, sx: 1 + 0.14 * squash, sy: 1 - 0.18 * squash, opacity: 1, label: plan.arg, look }
}

/**
 * How strongly the box glows at one instant, and in what.
 *
 * @param plan - What becomes of every call in the lane.
 * @param theme - The visual tokens this variant is drawn with.
 * @param atMs - Offset from the start of the timeline.
 * @returns The strongest glow among the calls that reached the box.
 */
function boxFlash(plan: LanePlan, theme: MediaTheme, atMs: number): BoxFlash {
  let flash: BoxFlash = { strength: 0, tone: theme.tones.success }
  for (const call of plan.calls) {
    if (call.fate !== 'pass' && call.fate !== 'throw' && call.fate !== 'absorb') {
      continue
    }
    const strength = pulse(atMs, call.arriveAt + SQUASH_MS, FLASH_MS)
    if (strength > flash.strength) {
      flash = { strength, tone: call.fate === 'pass' ? theme.tones.success : theme.tones.danger }
    }
  }
  return flash
}

/**
 * Draw whatever the lane's wrapper is, behind the box.
 *
 * @param instant - The lane at this instant.
 * @returns SVG markup, or nothing for the plain lane.
 */
function renderWrapper(instant: LaneInstant): string {
  const { plan, geometry, metrics, theme, atMs } = instant
  if (plan.kind === 'once') {
    const solid = plan.cacheAt === undefined ? 0 : easeOut(progress(atMs, plan.cacheAt, CACHE_MS))
    const blip = plan.calls.reduce(
      (strongest, call) => (call.fate === 'cached' ? max(strongest, pulse(atMs, call.arriveAt, BLIP_MS)) : strongest),
      0
    )
    return renderRing(geometry.cx, solid, blip, metrics, theme)
  }
  if (plan.kind === 'gate') {
    return renderGate(geometry.cx, instant.shut, metrics, theme)
  }
  if (plan.kind === 'plain') {
    const drawn = plan.deadAt === undefined ? 0 : easeOut(progress(atMs, plan.deadAt, BAR_MS))
    return renderBar(geometry.cx, drawn, geometry.width / 2 - metrics.tokenRPx, metrics, theme)
  }
  return ''
}

/**
 * Draw what sits in front of the box: the shield, the burst of a throw, and the cache's badge.
 *
 * @param instant - The lane at this instant.
 * @returns SVG markup.
 */
function renderFront(instant: LaneInstant): string {
  const { plan, geometry, layout, metrics, theme, atMs } = instant
  const parts: string[] = []
  for (const call of plan.calls) {
    if (call.fate === 'throw' || call.fate === 'absorb') {
      const reach = plan.kind === 'shield' ? metrics.shieldRPx - 4 : metrics.burstReachPx
      parts.push(renderBurst(geometry.cx, progress(atMs, call.arriveAt + SQUASH_MS + 50, BURST_MS), reach, metrics, theme))
    }
  }
  if (plan.kind === 'shield') {
    const glow = plan.calls.reduce(
      (strongest, call) => (call.fate === 'absorb' ? max(strongest, pulse(atMs, call.arriveAt + SQUASH_MS + 50, SHIELD_MS)) : strongest),
      0
    )
    parts.push(renderShield(geometry.cx, glow, metrics, theme))
  }
  if (plan.kind === 'once' && plan.cacheAt !== undefined) {
    const stored =
      plan.calls.find((call) => call.fate === 'cached')?.valueText ?? plan.calls.find((call) => call.fate === 'pass')?.arg ?? ''
    const scale = easeOut(progress(atMs, plan.cacheAt, CACHE_MS))
    const glow = plan.calls.reduce(
      (strongest, call) => (call.fate === 'cached' ? max(strongest, pulse(atMs, call.swapAt, STAMP_MS)) : strongest),
      0
    )
    parts.push(renderBadge(geometry.cx + layout.badgeDx, metrics.boxYPx + layout.badgeDy, scale, glow, stored, metrics, theme))
  }
  return parts.join('')
}

/**
 * Draw one lane at one instant: its rail, tray, wrapper, box, values and tokens.
 *
 * @param instant - The lane at this instant.
 * @returns SVG markup for the whole lane.
 * @example The second lane at one second
 * ```ts
 * renderLane({ config, layout, metrics, theme, geometry, plan, shut: 0, atMs: 1_000 })
 * ```
 */
export function renderLane(instant: LaneInstant): string {
  const { config, layout, metrics, theme, geometry, plan, atMs } = instant
  const flash = boxFlash(plan, theme, atMs)
  const rail = `<line x1="${geometry.cx}" y1="${metrics.railTopPx}" x2="${geometry.cx}" y2="${metrics.railBottomPx}" stroke="${theme.rule}" stroke-width="1.5"/>`
  const values = plan.calls
    .map((call, index) =>
      renderValue(
        geometry.slots[index] ?? geometry.cx,
        call.valueKind,
        call.valueText,
        easeOut(progress(atMs, call.valueAt, VALUE_MS)),
        metrics,
        theme
      )
    )
    .join('')
  const tokens = plan.calls
    .map((call, index) => {
      const pose = tokenPose(call, geometry.cx, geometry.slots[index] ?? geometry.cx, layout, metrics, atMs)
      return pose === undefined ? '' : renderToken(pose, metrics, theme)
    })
    .join('')
  return `${rail}${renderTray(geometry.cx, geometry.trayW, metrics, theme)}${renderWrapper(instant)}${renderBox(geometry.cx, config.fn, flash.strength, flash.tone, metrics, theme)}${renderFront(instant)}${values}${tokens}`
}
