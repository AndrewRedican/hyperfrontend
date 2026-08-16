/**
 * The wiring between the pond's own contract and the scene.
 *
 * This is the pond's *outer* relationship — the one it has with whatever
 * gallery mounted it. Nothing about an individual koi crosses here: the gallery
 * is told how many fish are swimming and when a disturbance sequence has
 * finished unwinding, and it can strike the water without a pointer. It is not
 * told that there are eight separate applications behind the scene, because it
 * does not need to be.
 *
 * It depends on a hand-written structural port rather than the SDK's concrete
 * handle type, so the whole binding is testable against a plain object.
 */

/** The slice of the feature handle this wiring needs. */
export interface PondLink {
  /** Subscribes to a lifecycle or contract event. */
  on(event: string, handler: (data: unknown) => void): unknown
  /** Sends a contract event to the gallery hosting the pond. */
  send(type: string, data?: unknown): void
}

/** How the pond is being presented; a card damps the ambient motion for a small frame. */
export type SceneScale = 'card' | 'full'

/** The slice of the scene the pond's own contract drives. */
export interface PondScene {
  /**
   * Adopts a presentation scale.
   *
   * @param scale - How the pond is being surfaced.
   */
  setScale(scale: SceneScale): void
  /**
   * Strikes the water at a fraction across the pond.
   *
   * @param fx - Fraction across the pond's width, 0 to 1.
   * @param fy - Fraction down the pond's height, 0 to 1.
   */
  disturbAt(fx: number, fy: number): void
}

/**
 * Binds the pond's own contract to the scene.
 *
 * @param link - The feature handle, or a test double of it.
 * @param scene - The scene the contract drives.
 *
 * @example Wiring the pond as a hostee
 * ```typescript
 * wirePondContract(feature, scene)
 * ```
 */
export function wirePondContract(link: PondLink, scene: PondScene): void {
  link.on('set-scene', (data) => {
    const requested = (<{ scene?: unknown }>data).scene
    // why: An unrecognised scale reads as the full scene rather than being refused — a pond that stops animating is a worse answer than one presented slightly too large.
    scene.setScale(requested === 'card' ? 'card' : 'full')
  })

  link.on('disturb', (data) => {
    const request = <{ fx: number; fy: number }>data
    scene.disturbAt(request.fx, request.fy)
  })
}

/** What the pond reports back to the gallery that mounted it. */
export interface PondReporter {
  /**
   * Reports how much of the shoal is currently connected.
   *
   * @param connected - How many koi are swimming.
   * @param expected - How many the pond expects.
   */
  shoal(connected: number, expected: number): void
  /**
   * Reports that a disturbance sequence has fully unwound.
   *
   * @param fish - How many koi took part in it.
   */
  sequenceComplete(fish: number): void
}

/**
 * Builds the reporter the scene uses to talk back to the gallery.
 *
 * @param link - The feature handle, or a test double of it.
 * @returns The reporter.
 */
export function createPondReporter(link: PondLink): PondReporter {
  return {
    shoal(connected, expected) {
      link.send('shoal', { connected, expected })
    },
    sequenceComplete(fish) {
      link.send('sequence-complete', { fish })
    },
  }
}
