/**
 * This app's runtime: the brain, the renderer, and the loop that drives them.
 *
 * The koi swims whether or not a pond is listening. Opened directly in a tab
 * the SDK creates no channel at all, so `send` is a no-op and nothing ever
 * announces a world — the runtime falls back to its own frame, and a visitor
 * who opens `/fish-svelte/` sees one koi swimming in clear water. That is the
 * standalone story every fish app in the pond keeps.
 *
 * The loop never touches the DOM. It advances the brain and hands each frame
 * to the renderer; the mounted stage decides what that means on screen.
 */
import type { Disturbance, KoiIdentity, KoiProfile, NeighborObservation, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { KoiRuntime } from '../feature/wire-contract'
import type { KoiRenderer } from '../koi/koi-render'
import { describePond, entryStation, koiProfile, koiSeed, mayRipple, pondWindow } from '@hyperfrontend/demo-koi-lib'
import { createKoiMotion } from '../koi/koi-motion'
import { createKoiRenderer } from '../koi/koi-render'

/** How a runtime builds its renderer, replaceable so specs can run without a GPU. */
export type KoiRendererFactory = (root: HTMLElement, profile: KoiProfile, url: string, pond: PondEnvironment) => KoiRenderer

/** How often the koi reports its outline to the host, in milliseconds. */
const OUTLINE_INTERVAL_MS = 100

/** Longest delta a single frame may report, in seconds. */
const MAX_FRAME_S = 0.1

/** How hard a koi breaking the surface strikes the water. */
const WAKE_STRENGTH = 0.45

/** How long the koi waits between asking the host for surface ripples, in milliseconds. */
const RIPPLE_INTERVAL_MS = 700

/** Which framework this app renders. */
const FRAMEWORK = 'svelte'

/**
 * Creates the runtime, mounts the koi, and starts it swimming.
 *
 * @param root - The app root the koi is drawn into.
 * @param buildRenderer - The renderer factory, replaceable so specs can run without a GPU.
 * @returns The runtime the contract wiring drives.
 *
 * @example Booting the koi
 * ```typescript
 * export const koi = createKoiRuntime(document.querySelector('#app'))
 * ```
 */
export function createKoiRuntime(root: HTMLElement, buildRenderer: KoiRendererFactory = createKoiRenderer): KoiRuntime {
  const profile: KoiProfile = koiProfile(FRAMEWORK)
  // why: Standalone the host never announces a world, so the koi takes the same screen snapshot the host would — the virtual pond derives from the screen, and the frame only decides how much of it shows.
  let pond: PondEnvironment = describePond(
    window.screen.width,
    window.screen.height,
    window.innerWidth,
    window.innerHeight,
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  const entry = entryStation(pond, koiSeed(FRAMEWORK))
  const motion = createKoiMotion({ profile, pond, position: entry.position, heading: entry.heading, depth: 3 })
  // why: The koi may be framed from a sub-path of the pond or served at its own origin's root, so the identity a visitor reads is resolved from wherever this page actually is.
  const renderer = buildRenderer(root, profile, new URL('.', window.location.href).href, pond)

  let emit: (type: string, data?: unknown) => void = () => {}
  let hovered = false
  let paused = false
  let inspected = false
  let hosted = false
  let disposed = false
  let frameHandle = 0
  let lastOutlineAt = 0
  let lastFrameAt = 0
  let wasFleeing = false
  let lastRippleAt = 0

  const frame = (timestamp: number): void => {
    frameHandle = window.requestAnimationFrame(frame)
    if (lastFrameAt === 0) {
      lastFrameAt = timestamp
    }
    const raw = (timestamp - lastFrameAt) / 1000
    lastFrameAt = timestamp
    const dt = raw > MAX_FRAME_S ? MAX_FRAME_S : raw

    if (!inspected) {
      motion.advance(dt)
    }
    const state = motion.state
    // why: An inspected koi holds its position but keeps sculling gently — a mesh frozen mid-beat reads as a rendering fault, not a fish waiting to be looked at.
    renderer.draw(inspected ? { ...state, speed: state.length * 0.08 } : state, dt)
    if (hovered) {
      renderer.placeCard(state)
    }

    if (timestamp - lastOutlineAt >= OUTLINE_INTERVAL_MS) {
      lastOutlineAt = timestamp
      const outline = motion.outline()
      // why: The host dead-reckons outlines forward by reported speed, so a held koi must report itself stationary or its hover target slides away from its body.
      emit('outline', inspected ? { ...outline, speed: 0 } : outline)
      const requested = motion.takeDepthRequest()
      if (requested !== null) {
        emit('depth-request', { level: requested })
      }
      // why: Only the koi just under the surface may ask for a ripple, and only while it is moving hard enough to actually break it.
      if (mayRipple(state.depth) && state.speed > state.length && timestamp - lastRippleAt > RIPPLE_INTERVAL_MS) {
        lastRippleAt = timestamp
        emit('ripple-request', { x: state.position.x, y: state.position.y, strength: WAKE_STRENGTH })
      }
    }

    if (wasFleeing && !motion.isFleeing) {
      // why: The host waits for every koi to report itself settled before it calls a disturbance sequence complete.
      emit('settled', { framework: FRAMEWORK })
    }
    wasFleeing = motion.isFleeing
  }

  /** Stops the loop entirely; a stopped koi costs nothing, not even a callback. */
  const stop = (): void => {
    if (frameHandle !== 0) {
      window.cancelAnimationFrame(frameHandle)
      frameHandle = 0
    }
  }

  /** Starts the loop with a fresh clock, so the first frame back reports no false gap. */
  const start = (): void => {
    if (frameHandle === 0 && !disposed) {
      lastFrameAt = 0
      frameHandle = window.requestAnimationFrame(frame)
    }
  }

  const onResize = (): void => {
    // why: Once a host has spoken its announcements are authoritative and arrive on every resize; a window-measured view would briefly undo the host's.
    if (hosted) {
      return
    }
    // why: Only the visible window follows the frame — the virtual pond took its dimensions from the screen at startup and never moves under the fish.
    pond = { ...pond, view: pondWindow(pond, window.innerWidth, window.innerHeight) }
    motion.setPond(pond)
    renderer.setPond(pond)
  }

  const dispose = (): void => {
    if (disposed) {
      return
    }
    disposed = true
    stop()
    window.removeEventListener('resize', onResize)
    window.removeEventListener('pagehide', dispose)
    renderer.dispose()
  }

  start()
  window.addEventListener('resize', onResize)
  // why: The frame's GL context and callbacks should not outlive the page — a torn-down koi must leave nothing running.
  window.addEventListener('pagehide', dispose)

  return {
    setPond(next) {
      hosted = true
      pond = next
      motion.setPond(next)
      renderer.setPond(next)
    },
    adopt(identity: KoiIdentity) {
      motion.setDepth(identity.depth)
    },
    setDepth(level) {
      motion.setDepth(level)
    },
    startle(disturbance: Disturbance) {
      motion.startle(disturbance)
    },
    observe(neighbors: readonly NeighborObservation[]) {
      motion.observe(neighbors)
    },
    setHovered(next) {
      hovered = next
      renderer.setHovered(next)
      if (next) {
        renderer.placeCard(motion.state)
      }
    },
    setPaused(next) {
      // why: A sleeping koi cancels its animation frame outright — seven hidden frames each still waking per frame is exactly the battery cost the host's sleep exists to remove.
      paused = next
      if (paused) {
        stop()
      } else {
        start()
      }
    },
    setInspected(next) {
      inspected = next
    },
    dispose,
    connect(next) {
      emit = next
    },
  }
}
