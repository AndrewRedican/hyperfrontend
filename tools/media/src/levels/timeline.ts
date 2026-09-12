import type { LevelsConfig } from '../models/levels'
import { abs, max, min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { clamp01, easeInOut, easeOut, lerp, progress } from '../lib/motion'
import { levelIndex } from './layout'

/** How long a line takes to fade in or out once the knob reaches its stop. */
export const FADE_MS = 350

/** Opacity of a line the level hides: present, so the reader sees what is being kept out, but clearly not printed. */
export const GHOST = 0.14

/** How close the knob has to be to a stop, in stops, before the stop counts as reached. */
const TOUCH = 0.2

/** One slide of the knob, resolved to positions on the scale. */
export interface KnobMove {
  /** Stop the knob leaves. */
  from: number
  /** Stop the knob arrives at. */
  to: number
  /** When it sets off. */
  startMs: number
  /** How long the slide takes. */
  durationMs: number
}

/** Where the knob is at one instant. */
export interface KnobState {
  /** Position on the scale, a stop's index or a point between two. */
  position: number
  /** The stop the knob last came to rest on, which is the level in force. */
  landed: number
  /** Whether the knob is between stops. */
  moving: boolean
  /** When the knob last came to rest, or undefined while it is still on its opening stop. */
  landedAtMs: number | undefined
  /** When the current slide began, or undefined while the knob rests. */
  departedAtMs: number | undefined
}

/** One moment a line changes state, because the knob reached or left its stop. */
interface Crossing {
  /** When the knob crossed the stop. */
  atMs: number
  /** Whether the line is printed from then on. */
  visible: boolean
}

/**
 * Resolve the scene's moves to slides between stops.
 *
 * @param config - The scene's configuration.
 * @returns Each move with the stop it leaves filled in from the one before.
 * @example The moves of a scene that starts at log
 * ```ts
 * compileMoves(config)
 * ```
 */
export function compileMoves(config: LevelsConfig): readonly KnobMove[] {
  let from = levelIndex(config.start)
  const moves: KnobMove[] = []
  for (const move of config.moves) {
    const to = levelIndex(move.to)
    moves.push({ from, to, startMs: move.atMs, durationMs: move.durationMs })
    from = to
  }
  return moves
}

/**
 * When the knob has made its last landing.
 *
 * @param moves - The slides, in order.
 * @returns The offset at which the knob comes to rest for good.
 * @example When the last slide ends
 * ```ts
 * settledAt(compileMoves(config))
 * ```
 */
export function settledAt(moves: readonly KnobMove[]): number {
  return moves.reduce((latest, move) => max(latest, move.startMs + move.durationMs), 0)
}

/**
 * Work out where the knob is at one instant.
 *
 * @param moves - The slides, in order.
 * @param start - The stop the knob opens on.
 * @param atMs - Offset from the start of the timeline.
 * @returns The knob's position and what it is doing.
 * @example The knob half way through its first slide
 * ```ts
 * knobAt(moves, 2, moves[0].startMs + moves[0].durationMs / 2)
 * ```
 */
export function knobAt(moves: readonly KnobMove[], start: number, atMs: number): KnobState {
  let landed = start
  let landedAtMs: number | undefined = undefined
  for (const move of moves) {
    if (atMs < move.startMs) {
      break
    }
    const endMs = move.startMs + move.durationMs
    if (atMs < endMs) {
      const t = easeInOut(progress(atMs, move.startMs, move.durationMs))
      // why: the knob counts as landed once it is within touching distance of its stop, the same tolerance the lines use, so the chip names the level no later than the output changes
      const reach = abs(move.to - move.from)
      const touchedAt = move.startMs + inverseEaseInOut(reach === 0 ? 1 : max(0, 1 - TOUCH / reach)) * move.durationMs
      const touched = atMs >= touchedAt
      return {
        position: lerp(move.from, move.to, t),
        landed: touched ? move.to : landed,
        moving: true,
        landedAtMs: touched ? touchedAt : landedAtMs,
        departedAtMs: move.startMs,
      }
    }
    landed = move.to
    landedAtMs = endMs
  }
  return { position: landed, landed, moving: false, landedAtMs, departedAtMs: undefined }
}

/**
 * The linear progress at which an eased slide has covered a given fraction of its distance.
 *
 * The inverse of `easeInOut`, so a stop part way along a slide can be given
 * the exact moment the knob passes it rather than a sampled guess.
 *
 * @param fraction - How much of the distance has been covered, from 0 to 1.
 * @returns Linear progress from 0 to 1.
 */
function inverseEaseInOut(fraction: number): number {
  const f = clamp01(fraction)
  if (f < 0.5) {
    return (f / 4) ** (1 / 3)
  }
  return (2 - (2 * (1 - f)) ** (1 / 3)) / 2
}

/**
 * Every moment a line's stop is reached or left by the knob.
 *
 * @param moves - The slides, in order.
 * @param lineIndex - The line's stop on the scale.
 * @returns The crossings, in time order.
 */
function crossingsFor(moves: readonly KnobMove[], lineIndex: number): readonly Crossing[] {
  // why: the line lights a little before the knob's centre reaches the stop, so an arrival reads as touching the stop rather than stopping short of it
  const threshold = lineIndex - TOUCH
  const found: Crossing[] = []
  for (const move of moves) {
    if (threshold <= min(move.from, move.to) || threshold >= max(move.from, move.to)) {
      continue
    }
    const fraction = (threshold - move.from) / (move.to - move.from)
    found.push({ atMs: move.startMs + inverseEaseInOut(fraction) * move.durationMs, visible: move.to > move.from })
  }
  return found
}

/**
 * How visible one line is at one instant.
 *
 * A line prints while the knob sits at or beyond its stop, and fades between
 * printed and ghosted as the knob crosses the stop; the knob's own motion is
 * what decides the timing, so a fast slide and a slow one both change the
 * line exactly as the knob passes.
 *
 * @param moves - The slides, in order.
 * @param start - The stop the knob opens on.
 * @param lineIndex - The line's stop on the scale.
 * @param atMs - Offset from the start of the timeline.
 * @returns Opacity from the ghosted value to 1.
 * @example The info line as the knob passes its stop
 * ```ts
 * lineOpacityAt(moves, 2, 3, 1_900)
 * ```
 */
export function lineOpacityAt(moves: readonly KnobMove[], start: number, lineIndex: number, atMs: number): number {
  let opacity = start >= lineIndex - TOUCH ? 1 : GHOST
  for (const crossing of crossingsFor(moves, lineIndex)) {
    if (atMs < crossing.atMs) {
      break
    }
    opacity = lerp(opacity, crossing.visible ? 1 : GHOST, easeOut(progress(atMs, crossing.atMs, FADE_MS)))
  }
  return opacity
}
