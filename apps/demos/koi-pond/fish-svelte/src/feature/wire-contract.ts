/**
 * The wiring between the koi contract and this app's runtime.
 *
 * It depends on a hand-written structural port rather than the SDK's concrete
 * handle type, which is what lets the whole binding be tested against a plain
 * object with no browser and no channel.
 *
 * The `neighbors` action is schema-less on the wire — that is the deliberate
 * hot-path escape hatch the contract documents — so it is the one payload this
 * module narrows by hand instead of trusting the SDK's validator.
 */
import type { Disturbance, KoiIdentity, KoiTune, NeighborObservation, PondEnvironment } from '@hyperfrontend/demo-koi-lib'

/** The slice of the feature handle this wiring needs. */
export interface FeatureLink {
  /** Subscribes to a lifecycle or contract event. */
  on(event: string, handler: (data: unknown) => void): unknown
  /** Sends a contract event to the pond host. */
  send(type: string, data?: unknown): void
}

/** The slice of this app's runtime the contract drives. */
export interface KoiRuntime {
  /** Adopts a newly announced world. */
  setPond(pond: PondEnvironment): void
  /** Takes the identity the host assigned at open. */
  adopt(identity: KoiIdentity): void
  /** Takes a granted depth level. */
  setDepth(level: number): void
  /** Reacts to something striking the water. */
  startle(disturbance: Disturbance): void
  /** Takes the host's relayed view of who is nearby. */
  observe(neighbors: readonly NeighborObservation[]): void
  /** Shows or hides this koi's own hover identity. */
  setHovered(hovered: boolean): void
  /** Holds still, or resumes. */
  setPaused(paused: boolean): void
  /** Holds position for inspection while sculling in place, or resumes swimming. */
  setInspected(inspected: boolean): void
  /** Takes the visitor's playground settings. */
  applyTune(tune: KoiTune): void
  /** Hands the runtime the channel it emits on. */
  connect(emit: (type: string, data?: unknown) => void): void
}

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
  const numeric = ['x', 'y', 'heading', 'speed', 'depth', 'length', 'girth']
  if (typeof record['framework'] !== 'string' || numeric.some((key) => typeof record[key] !== 'number')) {
    return null
  }
  return <NeighborObservation>value
}

/**
 * Binds the koi contract to this app's runtime.
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
    koi.setInspected((<{ paused: boolean }>data).paused)
  })

  link.on('tune', (data) => {
    koi.applyTune(<KoiTune>data)
  })

  link.on('neighbors', (data) => {
    // why: `neighbors` is schema-less so the SDK never validated it; a malformed relay must thin the shoal, never crash the frame.
    const entries = Array.isArray(data) ? data : []
    const observed: NeighborObservation[] = []
    for (const entry of entries) {
      const neighbor = readNeighbor(entry)
      if (neighbor !== null) {
        observed.push(neighbor)
      }
    }
    koi.observe(observed)
  })

  link.on('close', () => {
    // why: A closed channel means no host is watching; the koi keeps swimming but stops reporting and drops any hover the host had set.
    koi.setHovered(false)
    koi.observe([])
  })
}
