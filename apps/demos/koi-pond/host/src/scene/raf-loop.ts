/**
 * The pond's frame clock.
 *
 * One loop drives the whole scene. It hands out a clamped delta so a tab
 * returning from the background does not teleport the shoal across the pond,
 * and it stops entirely while the document is hidden — seven iframes each on
 * their own compositing layer is exactly the situation where a loop running
 * against a hidden tab costs a visitor real battery.
 */

/** What the loop hands its subscriber each frame. */
export interface FrameTick {
  /** Seconds since the previous frame, clamped to {@link MAX_FRAME_S}. */
  dt: number
  /** Milliseconds since the loop started. */
  elapsedMs: number
}

/** Longest delta a single frame may report, in seconds. */
export const MAX_FRAME_S = 0.1

/** A running frame loop. */
export interface FrameLoop {
  /** Starts the loop, or resumes it after a stop. */
  start(): void
  /** Stops the loop and releases its frame request. */
  stop(): void
  /** Whether the loop is currently requesting frames. */
  readonly isRunning: boolean
}

/** The pieces of the platform the loop needs, injected so specs can drive it by hand. */
export interface FrameLoopHost {
  /** Requests the next animation frame. */
  requestFrame(callback: (timestamp: number) => void): number
  /** Cancels a pending frame request. */
  cancelFrame(handle: number): void
  /** Reads the current time in milliseconds. */
  now(): number
}

/**
 * Creates the pond's frame loop.
 *
 * @param onFrame - Invoked once per frame with the clamped delta and elapsed time.
 * @param host - Platform hooks; defaults to the browser's.
 * @returns The loop handle.
 *
 * @example Driving the scene
 * ```typescript
 * const loop = createFrameLoop(({ dt }) => scene.advance(dt))
 * loop.start()
 * ```
 */
export function createFrameLoop(onFrame: (tick: FrameTick) => void, host?: Partial<FrameLoopHost>): FrameLoop {
  const requestFrame = host?.requestFrame ?? ((callback: (timestamp: number) => void) => requestAnimationFrame(callback))
  const cancelFrame = host?.cancelFrame ?? ((handle: number) => cancelAnimationFrame(handle))
  const now = host?.now ?? (() => Date.now())

  let handle: number | null = null
  let lastAt = 0
  let startedAt = 0

  const step = (): void => {
    const at = now()
    // why: A tab waking from the background reports a delta of minutes; clamping keeps the shoal where the visitor left it.
    const raw = (at - lastAt) / 1000
    lastAt = at
    onFrame({ dt: raw > MAX_FRAME_S ? MAX_FRAME_S : raw, elapsedMs: at - startedAt })
    handle = requestFrame(step)
  }

  return {
    start() {
      if (handle !== null) {
        return
      }
      const at = now()
      lastAt = at
      if (startedAt === 0) {
        startedAt = at
      }
      handle = requestFrame(step)
    },
    stop() {
      if (handle === null) {
        return
      }
      cancelFrame(handle)
      handle = null
    },
    get isRunning() {
      return handle !== null
    },
  }
}
