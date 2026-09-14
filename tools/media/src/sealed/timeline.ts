import type { SealedConfig } from '../models/sealed'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** When the sender's hello leaves. */
const HELLO_AT = 500

/** How long after the sender's hello leaves the receiver's does. */
const HELLO_OFFSET_MS = 300

/** How long the two ends rest, keyed, before the first message. */
const KEYED_REST_MS = 700

/** How long the header strip takes to slide onto a card, at full speed. */
const HEADER_MS = 350

/** How long the placeholder dots take to scramble into hatch, at full speed. */
const SEAL_MS = 320

/** How long the tag cap takes to snap on, at full speed. */
const TAG_MS = 280

/** How much faster the second message wraps than the first, which the eye has already followed once. */
const REPEAT_SPEED = 0.75

/** How long the loop rests between one message being absorbed and the next card appearing. */
const MESSAGE_GAP_MS = 300

/** How far into the last message's crossing the listener's copy peels off: half way, over the eye. */
const PEEL_OFFSET_MS = 500

/** How long a hello takes to cross the pipe. */
export const HELLO_MS = 900

/** How long a card takes to appear beside the sender. */
export const CARD_MS = 300

/** How long a frame takes to cross the pipe. */
export const TRAVEL_MS = 1000

/** How long a frame takes to unwrap at the receiver. */
export const UNWRAP_MS = 450

/** How long an unwrapped card takes to fade into the receiver. */
export const ABSORB_MS = 350

/** How long the copy takes to peel off the pipe and park beside the listener. */
export const PEEL_MS = 600

/** How long the parked copy takes to brighten before it is pushed back in. */
export const BRIGHTEN_MS = 300

/** How long the copy takes to arc back into the pipe. */
export const RISE_MS = 500

/** How long the copy takes to travel from where it re-entered to the receiver's edge. */
export const PUSH_MS = 700

/** How long the counter comparison is shown before the copy falls. */
export const COMPARE_MS = 600

/** How long the refused copy takes to fall into the tray. */
export const FALL_MS = 500

/** How long a fade of a label or a code takes. */
export const FADE_MS = 250

/** How long a node's key glows when it seals or opens a frame. */
export const KEY_PULSE_MS = 600

/** The moments one message passes through. */
export interface MessageSchedule {
  /** When the card appears beside the sender. */
  cardAt: number
  /** When the header strip starts sliding on. */
  wrapAt: number
  /** When the dots start scrambling into hatch. */
  sealAt: number
  /** When the tag cap starts snapping on. */
  tagAt: number
  /** When the frame sets off across the pipe. */
  travelAt: number
  /** When the frame reaches the receiver's edge. */
  arriveAt: number
  /** When the frame starts unwrapping. */
  unwrapAt: number
  /** When the unwrapped card starts fading into the receiver. */
  absorbAt: number
  /** When nothing of this message is left to draw. */
  doneAt: number
  /** How long the header strip takes to slide on. */
  headerMs: number
  /** How long the dots take to scramble. */
  sealMs: number
  /** How long the tag cap takes to snap on. */
  tagMs: number
}

/** Every moment on the stage's timeline. */
export interface SealedTimeline {
  /** When the sender's hello leaves. */
  helloOutAt: number
  /** When the receiver's hello leaves. */
  helloBackAt: number
  /** When the receiver's key turns, the sender's hello having arrived. */
  receiverKeyedAt: number
  /** When the sender's key turns, the receiver's hello having arrived. */
  senderKeyedAt: number
  /** Each message, in order. */
  messages: readonly MessageSchedule[]
  /** When the listener lights, just before it copies. */
  copyAt: number
  /** When the copy peels off the last message mid-pipe. */
  peelAt: number
  /** When the copy is parked beside the listener. */
  parkedAt: number
  /** When the parked copy starts brightening. */
  replayAt: number
  /** When the copy starts arcing back into the pipe. */
  riseAt: number
  /** When the copy is back in the pipe. */
  risenAt: number
  /** When the copy is pushed towards the receiver. */
  pushAt: number
  /** When the copy stops at the receiver's edge. */
  stopAt: number
  /** When the header's counter flashes and the comparison appears. */
  compareAt: number
  /** When the refused copy starts falling into the tray. */
  fallAt: number
  /** When the copy has landed in the tray. */
  landedAt: number
  /** When the drop code starts fading in beside it. */
  codeAt: number
  /** When nothing is moving any more. */
  settledAt: number
}

/**
 * The moments one message passes through, given when its card appears and how fast it wraps.
 *
 * @param cardAt - When the card appears beside the sender.
 * @param speed - How much faster than the reference durations the wrap runs; 1 is the reference.
 * @returns Every moment of that message, with the durations its wrap was scaled to.
 * @example The first message's schedule, at the reference speed
 * ```ts
 * messageSchedule(2_300, 1).arriveAt
 * ```
 */
export function messageSchedule(cardAt: number, speed: number): MessageSchedule {
  const headerMs = round(HEADER_MS * speed)
  // why: the scramble is the one beat that has to stay legible, so a repeat keeps it at full length and only its header and tag move faster
  const sealMs = SEAL_MS
  const tagMs = round(TAG_MS * speed)
  const wrapAt = cardAt + CARD_MS + 50
  const sealAt = wrapAt + round(200 * speed)
  const tagAt = sealAt + round(220 * speed)
  const travelAt = tagAt + tagMs + 120
  const arriveAt = travelAt + TRAVEL_MS
  const unwrapAt = arriveAt + 120
  const absorbAt = unwrapAt + UNWRAP_MS + 50
  return {
    cardAt,
    wrapAt,
    sealAt,
    tagAt,
    travelAt,
    arriveAt,
    unwrapAt,
    absorbAt,
    doneAt: absorbAt + ABSORB_MS,
    headerMs,
    sealMs,
    tagMs,
  }
}

/**
 * Lay the whole timeline out from the scene's configuration.
 *
 * @param config - The exchange as the scene configured it.
 * @returns Every moment the renderer keys off.
 * @example When the loop rests
 * ```ts
 * sealedTimeline(config).settledAt
 * ```
 */
export function sealedTimeline(config: SealedConfig): SealedTimeline {
  const helloOutAt = HELLO_AT
  const helloBackAt = helloOutAt + HELLO_OFFSET_MS
  const receiverKeyedAt = helloOutAt + HELLO_MS
  const senderKeyedAt = helloBackAt + HELLO_MS
  const messages: MessageSchedule[] = []
  let cardAt = senderKeyedAt + KEYED_REST_MS
  for (let index = 0; index < config.messages; index += 1) {
    const schedule = messageSchedule(cardAt, index === 0 ? 1 : REPEAT_SPEED)
    messages.push(schedule)
    cardAt = schedule.doneAt + MESSAGE_GAP_MS
  }
  const last = messages[messages.length - 1] ?? messageSchedule(cardAt, 1)
  const peelAt = last.travelAt + PEEL_OFFSET_MS
  const replayAt = last.doneAt + 400
  const riseAt = replayAt + BRIGHTEN_MS
  const risenAt = riseAt + RISE_MS
  const pushAt = risenAt + 120
  const stopAt = pushAt + PUSH_MS
  const compareAt = stopAt + 120
  const fallAt = compareAt + COMPARE_MS
  const landedAt = fallAt + FALL_MS
  const codeAt = landedAt + 80
  return {
    helloOutAt,
    helloBackAt,
    receiverKeyedAt,
    senderKeyedAt,
    messages,
    copyAt: peelAt - 120,
    peelAt,
    parkedAt: peelAt + PEEL_MS,
    replayAt,
    riseAt,
    risenAt,
    pushAt,
    stopAt,
    compareAt,
    fallAt,
    landedAt,
    codeAt,
    settledAt: codeAt + FADE_MS + 150,
  }
}
