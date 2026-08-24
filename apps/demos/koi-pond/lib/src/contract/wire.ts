/**
 * The wiring between the koi contract and the runtime of the app rendering a koi.
 *
 * Every koi speaks the same contract however its app is written, so the binding
 * from the wire to a runtime is one piece of plumbing rather than one per
 * framework. It types against a hand-written structural port of the feature
 * handle instead of the SDK's concrete type, which keeps this library free of
 * the SDK and lets the whole binding be exercised against a plain object with
 * no browser and no channel.
 *
 * The `neighbors` action is schema-less on the wire, the deliberate hot-path
 * escape hatch the contract documents, so it is the one payload this module
 * narrows by hand instead of trusting the SDK's validator.
 */
import type { Disturbance, KoiIdentity, NeighborObservation, PondEnvironment, Vec2 } from '../model/types.js'

/** The slice of the feature handle this wiring needs. */
export interface FeatureLink {
  /**
   * Subscribes to a lifecycle or contract event.
   *
   * @param event - The event name to listen for.
   * @param handler - What to run with the event's payload.
   * @returns Whatever the handle hands back for the subscription.
   */
  on(event: string, handler: (data: unknown) => void): unknown
  /**
   * Sends a contract event to the pond host.
   *
   * @param type - The action type being emitted.
   * @param data - The payload that action carries.
   */
  send(type: string, data?: unknown): void
}

/** The slice of a koi app's runtime the contract drives. */
export interface KoiRuntime {
  /**
   * Adopts a newly announced world.
   *
   * @param pond - The world the host announced.
   */
  setPond(pond: PondEnvironment): void
  /**
   * Takes the identity the host assigned at open.
   *
   * The dealt seed is the authority every trait derives from: a koi handed a
   * seed other than the one it assumed rebuilds itself around it, so a
   * duplicate swims as its own animal rather than a copy of the canonical one.
   *
   * @param identity - Who this koi is and where its app lives.
   */
  adopt(identity: KoiIdentity): void
  /**
   * Takes a granted depth level.
   *
   * @param level - The level the host granted.
   */
  setDepth(level: number): void
  /**
   * Reacts to something striking the water.
   *
   * @param disturbance - Where the water broke and how hard.
   */
  startle(disturbance: Disturbance): void
  /**
   * Takes the host's relayed view of who is nearby.
   *
   * @param neighbors - The koi close enough to matter.
   */
  observe(neighbors: readonly NeighborObservation[]): void
  /**
   * Shows or hides this koi's own hover identity.
   *
   * @param hovered - Whether the host's pointer is over this koi.
   */
  setHovered(hovered: boolean): void
  /**
   * Holds still, or resumes.
   *
   * @param paused - Whether the koi stops animating entirely.
   */
  setPaused(paused: boolean): void
  /**
   * Holds position while sculling in place, or resumes swimming.
   *
   * @param inspected - Whether the koi holds where it is.
   * @param resting - Whether the hold is a resting one, which keeps the scull and shows none of the held-inspection chrome.
   */
  setInspected(inspected: boolean, resting: boolean): void
  /**
   * Carries the held koi to a pond point while a visitor drags it.
   *
   * @param point - Where the koi's nose is being carried, in pond space.
   */
  placeAt(point: Vec2): void
  /** Stops the loop and releases everything the koi holds. */
  dispose(): void
  /**
   * Hands the runtime the channel it emits on.
   *
   * @param emit - How the runtime sends an action to the pond host.
   */
  connect(emit: (type: string, data?: unknown) => void): void
}

/** The numeric fields a relayed neighbour must carry to be steerable. */
const NEIGHBOR_NUMBERS = ['x', 'y', 'heading', 'speed', 'depth', 'length', 'girth']

/**
 * Narrows a relayed neighbour, dropping anything that is not one.
 *
 * @param value - One entry from the schema-less `neighbors` payload.
 * @returns The observation, or `null` when the entry is not usable.
 */
function readNeighbor(value: unknown): NeighborObservation | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const record = <Record<string, unknown>>value
  if (typeof record['framework'] !== 'string' || NEIGHBOR_NUMBERS.some((key) => typeof record[key] !== 'number')) {
    return null
  }
  return <NeighborObservation>value
}

/**
 * Narrows a whole relayed shoal, keeping only the neighbours worth steering around.
 *
 * @param data - The schema-less `neighbors` payload.
 * @returns Every usable observation, in the order relayed.
 */
// ref: [guide:compose-independent-features/neighbors-handler] start
function readShoal(data: unknown): NeighborObservation[] {
  // why: `neighbors` is schema-less so the SDK never validated it; a malformed relay must thin the shoal, never crash the frame.
  const entries = Array.isArray(data) ? data : []
  const observed: NeighborObservation[] = []
  for (const entry of entries) {
    const neighbor = readNeighbor(entry)
    if (neighbor !== null) {
      observed.push(neighbor)
    }
  }
  return observed
}
// ref: [guide:compose-independent-features/neighbors-handler] end

/**
 * Binds the koi contract to a koi app's runtime.
 *
 * @param link - The feature handle, or a test double of it.
 * @param koi - The runtime the contract drives.
 *
 * @example Wiring the live feature
 * ```typescript
 * wireKoiContract(feature, koi)
 * ```
 */
export function wireKoiContract(link: FeatureLink, koi: KoiRuntime): void {
  koi.connect((type, data) => link.send(type, data))

  link.on('pond', (data) => {
    koi.setPond(<PondEnvironment>data)
  })

  link.on('identity', (data) => {
    koi.adopt(<KoiIdentity>data)
  })

  link.on('depth', (data) => {
    koi.setDepth((<{ level: number }>data).level)
  })

  link.on('disturbance', (data) => {
    koi.startle(<Disturbance>data)
  })

  link.on('hover', (data) => {
    koi.setHovered((<{ hovered: boolean }>data).hovered)
  })

  link.on('sleep', (data) => {
    koi.setPaused((<{ paused: boolean }>data).paused)
  })

  link.on('pause', (data) => {
    const held = <{ paused: boolean; resting?: boolean }>data
    // why: A resting hold is still a hold, so the runtime is told both facts at once and decides for itself which chrome a rest suppresses.
    koi.setInspected(held.paused, held.resting === true)
  })

  link.on('place', (data) => {
    const point = <{ x: number; y: number }>data
    koi.placeAt({ x: point.x, y: point.y })
  })

  link.on('neighbors', (data) => {
    koi.observe(readShoal(data))
  })

  link.on('close', () => {
    // why: A closed channel means no host is watching; the koi keeps swimming but stops reporting and drops any hover the host had set.
    koi.setHovered(false)
    koi.observe([])
  })
}
