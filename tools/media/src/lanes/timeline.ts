import type { LanesConfig, LaneKind } from '../models/lanes'
import type { LanesMetrics } from './layout'
import { max, round, sqrt } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** How long a token takes to fall from where it appears to the box. */
const FALL_MS = 830

/** How long a token squashes and recovers when it lands on something. */
export const SQUASH_MS = 200

/** How long a token takes to sink into the box. */
export const DIVE_MS = 250

/** How long a token takes to come out of the bottom of the box. */
export const EMERGE_MS = 250

/** How long a token takes to drop from the box to the tray. */
export const DROP_MS = 600

/** How long a token takes to become the value in the tray. */
export const LAND_MS = 250

/** How long the box glows after a call reaches it. */
export const FLASH_MS = 700

/** How long the strokes of a throw take to radiate. */
export const BURST_MS = 500

/** How long the shield glows while it holds a throw in. */
export const SHIELD_MS = 700

/** How long the bar that seals a dead lane takes to draw. */
export const BAR_MS = 400

/** How long a bypassed token takes to ride round the box. */
export const BYPASS_MS = 650

/** How long a bypassed token takes to drop from the bottom of the arc to the tray. */
export const ARC_DROP_MS = 450

/** How long a skipped token takes to fade at the shut gate. */
export const FADE_MS = 400

/** How long the gate takes to swing, and the switch to flip. */
export const GATE_MS = 500

/** How long a value takes to fade into the tray. */
export const VALUE_MS = 300

/** How long the ring takes to become a cache once the first result is stored. */
export const CACHE_MS = 300

/** How long a wrapper's throw is held inside the box before the token is let out, on top of a plain dive. */
const ABSORB_HOLD_MS = 250

/** How far along the bypass, as eased progress, the token passes the badge; the inverse of the ease at the badge's angle. */
const BADGE_PASS = 0.41

/**
 * What becomes of one call in one lane.
 *
 * `pass` runs the function and returns. `throw` runs it, it throws, and the
 * lane is dead from then on. `dead` never runs, because the lane is dead.
 * `cached` never reaches the function and returns the stored result. `skip`
 * is turned back at the gate. `absorb` runs, throws, and the throw is held in.
 */
export type CallFate = 'pass' | 'throw' | 'dead' | 'cached' | 'skip' | 'absorb'

/** What is collected in the tray for one call. */
export type ValueKind = 'arg' | 'cached' | 'undefined' | 'dash' | 'cross' | 'check' | 'slashed'

/** Everything the renderer needs to draw one call's token and value in one lane. */
export interface CallPlan {
  /** What becomes of the call. */
  fate: CallFate
  /** The argument the token carries. */
  arg: string
  /** When the token appears at the top of the lane. */
  dropAt: number
  /** How long the token takes to reach whatever stops it. */
  fallMs: number
  /** When the token reaches whatever stops it. */
  arriveAt: number
  /** Vertical centre of the token when it stops. */
  stopY: number
  /** When the token comes out of the bottom of the box, for a call that ran and returned. */
  emergeAt: number
  /** When a bypassed token passes the badge and takes the stored value. */
  swapAt: number
  /** What lands in the tray. */
  valueKind: ValueKind
  /** The text of the value, for a kind that is text. */
  valueText: string
  /** When the value starts fading into the tray. */
  valueAt: number
  /** When nothing about this call moves any more. */
  settledAt: number
}

/** Everything the renderer needs for one lane. */
export interface LanePlan {
  /** Which wrapper the lane draws. */
  kind: LaneKind
  /** One plan per call, index for index with the config's calls. */
  calls: readonly CallPlan[]
  /** When the ring becomes a cache, or undefined for a lane that never stores anything. */
  cacheAt: number | undefined
  /** When the bar that seals the lane starts drawing, or undefined for a lane that never dies. */
  deadAt: number | undefined
}

/** Every moment on the stage's timeline. */
export interface LanesTimeline {
  /** One plan per lane, index for index with the config's lanes. */
  lanes: readonly LanePlan[]
  /** When nothing is moving any more. */
  settledAt: number
}

/** What a lane remembers between calls. */
interface LaneMemory {
  /** Whether a throw has ended the lane. */
  dead: boolean
  /** The result the lane stored, or undefined while it has none. */
  stored: string | undefined
}

/**
 * Where a token stops, for what becomes of it.
 *
 * @param fate - What becomes of the call.
 * @param metrics - The measurements this profile is drawn at.
 * @returns The vertical centre of the token when it stops.
 */
function stopFor(fate: CallFate, metrics: LanesMetrics): number {
  if (fate === 'cached') {
    return metrics.boxYPx - metrics.ringRPx - metrics.tokenRPx
  }
  if (fate === 'skip' || fate === 'dead') {
    return metrics.gateYPx - metrics.tokenRPx - 2
  }
  return metrics.boxYPx - metrics.boxHPx / 2 - metrics.tokenRPx - 1
}

/**
 * What becomes of one call in one lane, given what the lane remembers.
 *
 * @param kind - Which wrapper the lane draws.
 * @param offline - Whether the switch is off when the call is made.
 * @param memory - What the lane remembers from earlier calls.
 * @returns Whether the call runs, is turned away, is answered from the cache, or meets a throw.
 */
function fateFor(kind: LaneKind, offline: boolean, memory: LaneMemory): CallFate {
  if (kind === 'plain') {
    return memory.dead ? 'dead' : offline ? 'throw' : 'pass'
  }
  if (kind === 'once') {
    return memory.stored === undefined ? (offline ? 'throw' : 'pass') : 'cached'
  }
  if (kind === 'gate') {
    return offline ? 'skip' : 'pass'
  }
  return offline ? 'absorb' : 'pass'
}

/**
 * Plan one call in one lane: when everything happens and what lands in the tray.
 *
 * @param kind - Which wrapper the lane draws.
 * @param fate - What becomes of the call.
 * @param arg - The argument the token carries.
 * @param dropAt - When the token appears.
 * @param stored - The result the lane has stored, for a bypassed call.
 * @param metrics - The measurements this profile is drawn at.
 * @returns Every moment of the call and what it leaves in the tray.
 */
function planCall(
  kind: LaneKind,
  fate: CallFate,
  arg: string,
  dropAt: number,
  stored: string | undefined,
  metrics: LanesMetrics
): CallPlan {
  const stopY = stopFor(fate, metrics)
  const reference = stopFor('pass', metrics) - metrics.spawnYPx
  // why: every token falls under the same gravity, so one that is stopped sooner arrives sooner
  const fallMs = round(FALL_MS * sqrt((stopY - metrics.spawnYPx) / reference))
  const arriveAt = dropAt + fallMs
  const base = { fate, arg, dropAt, fallMs, arriveAt, stopY, emergeAt: 0, swapAt: 0 }
  if (fate === 'pass') {
    const emergeAt = arriveAt + SQUASH_MS + DIVE_MS
    const valueAt = emergeAt + EMERGE_MS + DROP_MS
    const valueKind: ValueKind = kind === 'shield' ? 'check' : 'arg'
    return { ...base, emergeAt, valueKind, valueText: arg, valueAt, settledAt: valueAt + LAND_MS }
  }
  if (fate === 'absorb') {
    const emergeAt = arriveAt + SQUASH_MS + DIVE_MS + ABSORB_HOLD_MS
    const valueAt = emergeAt + EMERGE_MS + DROP_MS
    return { ...base, emergeAt, valueKind: 'slashed', valueText: '', valueAt, settledAt: valueAt + LAND_MS }
  }
  if (fate === 'throw') {
    const valueAt = arriveAt + SQUASH_MS + BURST_MS + BAR_MS
    return { ...base, valueKind: 'cross', valueText: '', valueAt, settledAt: valueAt + VALUE_MS }
  }
  if (fate === 'cached') {
    const bypassAt = arriveAt + SQUASH_MS
    const valueAt = bypassAt + BYPASS_MS + ARC_DROP_MS
    return {
      ...base,
      swapAt: bypassAt + round(BADGE_PASS * BYPASS_MS),
      valueKind: 'cached',
      valueText: stored ?? '',
      valueAt,
      settledAt: valueAt + LAND_MS,
    }
  }
  if (fate === 'skip') {
    const valueAt = arriveAt + SQUASH_MS + FADE_MS - 100
    return { ...base, valueKind: 'undefined', valueText: 'undefined', valueAt, settledAt: valueAt + VALUE_MS }
  }
  const valueAt = arriveAt + SQUASH_MS + VALUE_MS
  return { ...base, valueKind: 'dash', valueText: '', valueAt, settledAt: valueAt + VALUE_MS }
}

/**
 * Lay the whole timeline out from the scene's configuration.
 *
 * Nothing is remembered between frames: what each lane has stored and
 * whether it is dead are read out of the calls before the one being drawn,
 * which is what lets the same scene record identically anywhere.
 *
 * @param config - The lanes as the scene configured them.
 * @param metrics - The measurements this profile is drawn at.
 * @returns Every moment the renderer keys off.
 * @example When the loop rests
 * ```ts
 * lanesTimeline(config, metrics).settledAt
 * ```
 */
export function lanesTimeline(config: LanesConfig, metrics: LanesMetrics): LanesTimeline {
  let settledAt = 0
  const lanes = config.lanes.map((lane): LanePlan => {
    const memory: LaneMemory = { dead: false, stored: undefined }
    let cacheAt: number | undefined = undefined
    let deadAt: number | undefined = undefined
    const calls = config.calls.map((call) => {
      const offline = call.atMs >= config.offAtMs && call.atMs < config.onAtMs
      const fate = fateFor(lane.kind, offline, memory)
      const plan = planCall(lane.kind, fate, call.arg, call.atMs, memory.stored, metrics)
      if (fate === 'throw') {
        memory.dead = true
        deadAt = plan.arriveAt + SQUASH_MS + BURST_MS - 100
      }
      if (fate === 'pass' && lane.kind === 'once') {
        memory.stored = call.arg
        cacheAt = plan.emergeAt
      }
      settledAt = max(settledAt, plan.settledAt)
      return plan
    })
    return { kind: lane.kind, calls, cacheAt, deadAt }
  })
  return { lanes, settledAt }
}
