/**
 * The identity card's inspector text, derived once so seven apps agree.
 *
 * Every koi renders its own card in its own framework — that independence is
 * the demo's point — but the *story* the card tells must be identical: the same
 * phase names, the same units, the same honesty about a metric the browser
 * would not attribute. Each app therefore renders these strings idiomatically
 * rather than deriving its own.
 */
import type { KoiPhase } from './types.js'

/** How a koi's memory reading stands. */
export type KoiMemoryState = 'pending' | 'measured' | 'unavailable'

/** The live facts one koi's card shows while a visitor holds it. */
export interface KoiCardDetails {
  /** Whether a visitor is holding this koi right now. */
  held: boolean
  /** The behavioural state the body is reading in. */
  phase: KoiPhase
  /** Forward speed in body lengths per second. */
  speedBL: number
  /** How many neighbours the host most recently relayed. */
  neighbours: number
  /** Whether a pond host mounted this app, or it is running standalone. */
  hosted: boolean
  /** How the app's origin relates to the page embedding it, or `null` standalone. */
  origin: 'same-origin' | 'cross-site' | null
  /** Seconds since this app booted. */
  uptimeS: number
  /** This app's own recent render rate in frames per second, or `null` before it settles. */
  fps: number | null
  /** Memory attributed to this app's own browsing context, in bytes, when measured. */
  memoryBytes: number | null
  /** How the memory reading stands. */
  memoryState: KoiMemoryState
  /** The most recent coordination event this app took part in, or `null`. */
  lastEvent: { kind: string; ageS: number } | null
}

/** What each behavioural phase is called on a card. */
const PHASE_LABELS: Readonly<Record<KoiPhase, string>> = {
  relaxed: 'Cruising',
  turning: 'Turning',
  escape: 'Fleeing',
  'depth-transition': 'Changing depth',
}

/** The card's rows, ready to render. */
export interface KoiCardText {
  /** The behaviour line, e.g. `Cruising · 0.4 L/s · 2 neighbours`. */
  state: string
  /** The runtime line, e.g. `Embedded · same-origin · up 3m 12s`. */
  runtime: string
  /** The memory line, e.g. `Memory · ~18 MB` or `Memory · unavailable`. */
  memory: string
  /** The last-event line, e.g. `Last event · disturbance · 1.2s ago`, or `null` when nothing happened yet. */
  event: string | null
}

/**
 * A duration in the shortest form a card can carry.
 *
 * @param seconds - The duration in seconds.
 * @returns The formatted duration.
 */
function spell(seconds: number): string {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m ${Math.floor(seconds % 60)}s`
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

/**
 * Derives the card's inspector rows from one koi's live facts.
 *
 * @param details - The live facts.
 * @returns The rows to render.
 *
 * @example Refreshing the card while held
 * ```typescript
 * const rows = describeKoiCard(details)
 * stateLine.textContent = rows.state
 * ```
 */
export function describeKoiCard(details: KoiCardDetails): KoiCardText {
  const speed = details.speedBL.toFixed(1)
  const company = details.neighbours === 1 ? '1 neighbour' : `${details.neighbours} neighbours`
  // why: A held koi's frozen phase and speed are stale facts — what is true right now is that a visitor is holding it while it sculls in place.
  const state = details.held ? `Held · sculling · ${company}` : `${PHASE_LABELS[details.phase]} · ${speed} L/s · ${company}`

  const mode = details.hosted ? 'Embedded' : 'Standalone'
  const origin = details.origin === null ? '' : ` · ${details.origin}`
  const rate = details.fps === null ? '' : ` · ${Math.round(details.fps)} fps`
  const runtime = `${mode}${origin} · up ${spell(details.uptimeS)}${rate}`

  // why: The reading is honest or it is absent — a browser that cannot attribute memory to this frame gets `unavailable`, never a share of somebody else's heap.
  const memory =
    details.memoryState === 'measured' && details.memoryBytes !== null
      ? `Memory · ~${(details.memoryBytes / (1024 * 1024)).toFixed(1)} MB`
      : details.memoryState === 'pending'
        ? 'Memory · measuring…'
        : 'Memory · unavailable'

  const event =
    details.lastEvent === null
      ? null
      : `Last event · ${details.lastEvent.kind} · ${details.lastEvent.ageS < 1 ? 'now' : `${details.lastEvent.ageS.toFixed(1)}s ago`}`

  return { state, runtime, memory, event }
}
