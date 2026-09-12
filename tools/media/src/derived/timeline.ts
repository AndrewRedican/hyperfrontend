import type { DerivedConfig, DerivedName, FlagValue } from '../models/derived'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { easeIn, easeOut, progress } from '../lib/motion'

/** How long the token takes to fall from the chip to the lamp. */
export const DROP_MS = 600

/** How long a changed lamp ripples after the token lands. */
export const FLASH_MS = 450

/** How long a lit wire takes to draw from the lamp to the name. */
export const WIRE_MS = 500

/** How long after the token lands a name starts to light, once its wires are most of the way to it. */
export const LIGHT_DELAY_MS = 320

/** How long a name takes to light. */
export const LIGHT_MS = 250

/** How long a name and its wires take to go out once they stop holding. */
export const FADE_MS = 300

/** How long a chip swells when it fires. */
export const FIRE_MS = 450

/** Value of every flag, keyed by name. */
export type Flags = Readonly<Record<string, boolean>>

/**
 * One resting state of the store: what every lamp holds from one landing to
 * the next, and which names hold with them.
 */
export interface StoreBeat {
  /** When the chip fired; the same as `landsAt` for the initial state, which nothing fires. */
  firesAt: number
  /** When the token lands and the lamps take these values. */
  landsAt: number
  /** Value of every flag. */
  flags: Flags
  /** Flags this beat changed. */
  changed: readonly string[]
  /** Names that hold. */
  holds: readonly string[]
  /** The flag the token lands on, or empty for the initial state. */
  target: string
}

/** Every moment on the stage's timeline. */
export interface DerivedTimeline {
  /** The initial state followed by the state after each action, in order. */
  beats: readonly StoreBeat[]
  /** When the last name has lit and nothing moves any more. */
  settledAt: number
}

/**
 * Whether a flag holds the value a read expects.
 *
 * @param flags - Value of every flag.
 * @param read - The flag and the value expected of it.
 * @returns True when they agree.
 */
function flagIs(flags: Flags, read: FlagValue): boolean {
  return (flags[read.flag] ?? false) === read.value
}

/**
 * Whether a name holds for a set of flags.
 *
 * @param name - The selector.
 * @param flags - Value of every flag.
 * @returns True when every `all` read agrees and, if `any` is given, at least one of its reads does.
 * @example `retrying` on a store that is in progress after a failure
 * ```ts
 * holdsIn(retrying, { inProgress: true, success: false, fail: true, halt: false }) // true
 * ```
 */
export function holdsIn(name: DerivedName, flags: Flags): boolean {
  return name.all.every((read) => flagIs(flags, read)) && (name.any === undefined || name.any.some((read) => flagIs(flags, read)))
}

/**
 * Every name that holds for a set of flags.
 *
 * @param config - The store as the scene configured it.
 * @param flags - Value of every flag.
 * @returns The names, in the order the scene lists them.
 */
function holdsOf(config: DerivedConfig, flags: Flags): readonly string[] {
  return config.names.filter((name) => holdsIn(name, flags)).map((name) => name.name)
}

/**
 * Work the timeline out from the actions: the state after each one, when it
 * lands, and which names hold in it.
 *
 * The reducer is data here: each action writes the flags it names and leaves
 * the rest, which is what lets the same action land somewhere different
 * depending on what the lamps already held.
 *
 * @param config - The store as the scene configured it.
 * @returns Every beat, and when the last one has settled.
 * @example The state after the first action
 * ```ts
 * derivedTimeline(config).beats[1]
 * ```
 */
export function derivedTimeline(config: DerivedConfig): DerivedTimeline {
  const initial = config.lamps.reduce<Flags>((flags, lamp) => ({ ...flags, [lamp.flag]: false }), {})
  const beats: StoreBeat[] = [{ firesAt: 0, landsAt: 0, flags: initial, changed: [], holds: holdsOf(config, initial), target: '' }]
  let flags = initial
  for (const action of config.actions) {
    const next = action.writes.reduce<Flags>((written, write) => ({ ...written, [write.flag]: write.value }), flags)
    const changed = action.writes.filter((write) => (flags[write.flag] ?? false) !== write.value).map((write) => write.flag)
    const lit = action.writes.find((write) => write.value)
    const target = lit?.flag ?? action.writes[0]?.flag ?? ''
    beats.push({ firesAt: action.atMs, landsAt: action.atMs + DROP_MS, flags: next, changed, holds: holdsOf(config, next), target })
    flags = next
  }
  const lastLanding = beats.reduce((latest, beat) => max(latest, beat.landsAt), 0)
  return { beats, settledAt: lastLanding + LIGHT_DELAY_MS + LIGHT_MS }
}

/**
 * Which beat the store is resting in at one instant.
 *
 * While a token is in the air the store still holds the previous beat: the
 * lamps do not change until it lands.
 *
 * @param timeline - The beats.
 * @param atMs - Offset from the start of the timeline.
 * @returns Index of the latest beat whose token has landed.
 * @example Before the first token lands
 * ```ts
 * beatIndexAt(timeline, 1_500) // 0
 * ```
 */
export function beatIndexAt(timeline: DerivedTimeline, atMs: number): number {
  return timeline.beats.reduce((current, beat, index) => (beat.landsAt <= atMs ? index : current), 0)
}

/**
 * How lit something is at one instant, given whether it is on in the current
 * beat and whether it was on in the one before.
 *
 * A thing that has just come on rises after its delay; one that has just gone
 * off fades from the landing; one that is on in both beats, or off in both,
 * does not move.
 *
 * @param onBefore - Whether it was on in the previous beat.
 * @param onNow - Whether it is on in the current beat.
 * @param landsAt - When the current beat landed.
 * @param delayMs - How long after the landing a rise begins.
 * @param riseMs - How long a rise takes.
 * @param atMs - Offset from the start of the timeline.
 * @returns Intensity from 0 to 1.
 * @example A name that has just started holding, a quarter of a second after landing
 * ```ts
 * levelAt(false, true, 1_900, 320, 250, 2_150) // 0
 * ```
 */
export function levelAt(onBefore: boolean, onNow: boolean, landsAt: number, delayMs: number, riseMs: number, atMs: number): number {
  if (onNow) {
    return onBefore ? 1 : easeOut(progress(atMs, landsAt + delayMs, riseMs))
  }
  return onBefore ? 1 - easeIn(progress(atMs, landsAt, FADE_MS)) : 0
}
