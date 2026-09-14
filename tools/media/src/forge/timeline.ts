import type { ForgeConfig } from '../models/forge'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** How many dots make up one entry's stream. */
export const DOTS_PER_STREAM = 3

/** When the first entry's stream sets off. */
export const LEAD_MS = 700

/** How far apart the dots of one stream leave. */
export const DOT_GAP_MS = 120

/** How long a dot takes to travel from its card into the builder. */
export const TRAVEL_MS = 700

/** How long the builder holds the whole entry before its first file pops. */
export const POP_LEAD_MS = 60

/** How far apart an entry's files pop. */
export const POP_GAP_MS = 160

/** How long one file takes to pop into place. */
export const POP_MS = 360

/** How long the thread from the builder to a freshly popped file stays before it fades. */
export const THREAD_FADE_MS = 500

/** How long the entry dots inside the builder take to fade once its last file has landed. */
export const CLUSTER_FADE_MS = 300

/** How long the builder stands empty between one entry's last fade and the next entry setting off. */
const HANDOVER_MS = 200

/** How long the manifest sheet takes to rise into place. */
export const SHEET_MS = 500

/** How far apart the wires into one key set off. */
export const WIRE_GAP_MS = 100

/** How long one wire takes to draw from a file to its key. */
export const WIRE_MS = 700

/** How far apart the keys start receiving their wires. */
export const KEY_STAGGER_MS = 400

/** How long the bracket down the side of the tree takes to draw. */
export const BRACKET_MS = 500

/** How long the bracket's tail takes to reach the key that spans every file. */
export const CONNECTOR_MS = 300

/** How long a key takes to light and grow once its first wire lands. */
export const LIT_MS = 300

/** How long the frame rests once everything is lit, unless the scene says otherwise. */
const DEFAULT_REST_MS = 1_300

/** How long the sheet waits after the last file has landed before it rises. */
const SHEET_LEAD_MS = 120

/** How long the wires wait after the sheet is in place. */
const WIRE_LEAD_MS = 100

/** Every moment one entry goes through. */
export interface EntrySchedule {
  /** When each dot of the stream leaves the card, index for index with the dots. */
  leaveAt: readonly number[]
  /** When the first dot reaches the builder and it starts working. */
  workStart: number
  /** When the last file has finished popping and the builder is empty again. */
  workEnd: number
  /** When each file pops into the tree, index for index with the entry's outputs. */
  popAt: readonly number[]
}

/** One wire from a file to a manifest key. */
export interface WireSchedule {
  /** Index of the file in the flattened tree. */
  tile: number
  /** The key it lands on. */
  key: string
  /** Which of the key's wires this is, for spreading the landings along the key. */
  ordinal: number
  /** How many wires land on that key altogether. */
  siblings: number
  /** When the wire starts drawing. */
  startAt: number
  /** When it lands. */
  landAt: number
}

/** Every moment on the forge's timeline, read out of the configuration. */
export interface ForgeTimeline {
  /** The entries, index for index with the configuration. */
  entries: readonly EntrySchedule[]
  /** When the manifest sheet starts rising. */
  sheetAt: number
  /** Every wire, in the order it sets off. */
  wires: readonly WireSchedule[]
  /** When the bracket starts drawing. */
  bracketAt: number
  /** When the bracket's tail starts reaching for its key. */
  connectorAt: number
  /** When each key lights, by key. */
  keyLitAt: Readonly<Record<string, number>>
  /** When everything is lit and still. */
  settledAt: number
}

/**
 * Work out when everything happens.
 *
 * The moments are derived from the configuration rather than written beside
 * it, so an entry with one more file, or a manifest with one more key, pushes
 * everything after it along without a scene having to re-time anything.
 *
 * @param config - The forge as the scene configured it.
 * @returns Every moment on the timeline.
 * @example Reading when the sheet rises
 * ```ts
 * const { sheetAt } = forgeTimeline(config)
 * ```
 */
export function forgeTimeline(config: ForgeConfig): ForgeTimeline {
  let cursor = LEAD_MS
  const entries: EntrySchedule[] = []
  const flatKeys: (readonly string[])[] = []
  for (const entry of config.entries) {
    const leaveAt: number[] = []
    // why: the dot furthest from the card leads, so the stream peels off from its outer end instead of the nearest dot passing through the ones still parked
    for (let dot = 0; dot < DOTS_PER_STREAM; dot += 1) {
      leaveAt.push(cursor + (DOTS_PER_STREAM - 1 - dot) * DOT_GAP_MS)
    }
    const lastArrival = cursor + (DOTS_PER_STREAM - 1) * DOT_GAP_MS + TRAVEL_MS
    const popAt = entry.outputs.map((_, index) => lastArrival + POP_LEAD_MS + index * POP_GAP_MS)
    const workEnd = lastArrival + POP_LEAD_MS + max(0, entry.outputs.length - 1) * POP_GAP_MS + POP_MS
    entries.push({ leaveAt, workStart: cursor + TRAVEL_MS, workEnd, popAt })
    for (const output of entry.outputs) {
      flatKeys.push(output.keys)
    }
    // why: the next entry leaves its card only once the builder is visibly empty, a beat after the last cluster has faded, which is what makes the queue at the card read as waiting for its turn
    cursor = workEnd + CLUSTER_FADE_MS + HANDOVER_MS
  }

  const sheetAt = cursor + SHEET_LEAD_MS
  const wiresAt = sheetAt + SHEET_MS + WIRE_LEAD_MS
  const wires: WireSchedule[] = []
  const keyLitAt: Record<string, number> = {}
  let bracketAt = wiresAt
  let latest = wiresAt
  config.manifest.keys.forEach((key, keyIndex) => {
    const keyStart = wiresAt + keyIndex * KEY_STAGGER_MS
    if (key === config.manifest.spanKey) {
      bracketAt = keyStart
      keyLitAt[key] = keyStart + BRACKET_MS + CONNECTOR_MS
      latest = max(latest, keyLitAt[key])
      return
    }
    const tiles: number[] = []
    flatKeys.forEach((keys, tile) => {
      if (keys.includes(key)) {
        tiles.push(tile)
      }
    })
    tiles.forEach((tile, ordinal) => {
      const startAt = keyStart + ordinal * WIRE_GAP_MS
      wires.push({ tile, key, ordinal, siblings: tiles.length, startAt, landAt: startAt + WIRE_MS })
      latest = max(latest, startAt + WIRE_MS)
    })
    const first = tiles.length === 0 ? keyStart : keyStart + WIRE_MS
    keyLitAt[key] = first
  })

  return {
    entries,
    sheetAt,
    wires,
    bracketAt,
    connectorAt: bracketAt + BRACKET_MS,
    keyLitAt,
    settledAt: latest + LIT_MS + (config.restMs ?? DEFAULT_REST_MS),
  }
}
