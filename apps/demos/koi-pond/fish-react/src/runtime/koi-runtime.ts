/**
 * This app's runtime: the brain, the renderer, and the loop that drives them.
 *
 * The koi swims whether or not a pond is listening. Opened directly in a tab
 * the SDK creates no channel at all, so `send` is a no-op and nothing ever
 * announces a world — the runtime falls back to its own frame, and a visitor
 * who opens `/fish-react/` sees one koi swimming in clear water. That is the
 * standalone story every fish app in the pond keeps.
 */
import type { Disturbance, KoiIdentity, KoiProfile, NeighborObservation, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { KoiRuntime } from '../feature/wire-contract'
import type { KoiRenderer } from '../koi/koi-render'
import { describePond, entryStation, koiProfile, koiSeed, mayRipple } from '@hyperfrontend/demo-koi-lib'
import { createKoiMotion } from '../koi/koi-motion'
import { createKoiRenderer } from '../koi/koi-render'

/** How a runtime builds its renderer, replaceable so specs can run without a GPU. */
export type KoiRendererFactory = (root: HTMLElement, profile: KoiProfile, url: string, pond: PondEnvironment) => KoiRenderer

/** How often the koi reports its outline to the host, in milliseconds. */
const OUTLINE_INTERVAL_MS = 100

/** Longest delta a single frame may report, in seconds. */
const MAX_FRAME_S = 1 / 20

/** Shortest gap between two ripple requests, in milliseconds. */
const RIPPLE_INTERVAL_MS = 700

/** How hard a koi breaking the surface strikes the water. */
const WAKE_STRENGTH = 0.45

/** The depth level the koi holds until the host grants it another. */
const OPENING_DEPTH = 3

/** Which framework this app renders. */
const FRAMEWORK = 'react'

/**
 * Creates the runtime and starts it swimming.
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
  // why: Standalone the host never announces a world, so the koi measures its own frame and swims in that.
  let pond: PondEnvironment = describePond(
    window.innerWidth,
    window.innerHeight,
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  const entry = entryStation(pond, koiSeed(FRAMEWORK))
  const motion = createKoiMotion({ profile, pond, position: entry.position, heading: entry.heading, depth: OPENING_DEPTH })
  const renderer = buildRenderer(root, profile, window.location.href, pond)

  let emit: (type: string, data?: unknown) => void = () => {}
  let hovered = false
  let paused = false
  let hosted = false
  let lastOutlineAt = 0
  let lastFrameAt = 0
  let startedAt = 0
  let wasFleeing = false
  let lastRippleAt = 0

  const frame = (timestamp: number): void => {
    window.requestAnimationFrame(frame)
    if (paused) {
      lastFrameAt = timestamp
      return
    }
    if (startedAt === 0) {
      startedAt = timestamp
      lastFrameAt = timestamp
    }
    const raw = (timestamp - lastFrameAt) / 1000
    lastFrameAt = timestamp
    const dt = raw > MAX_FRAME_S ? MAX_FRAME_S : raw
    const elapsedS = (timestamp - startedAt) / 1000

    motion.advance(dt, elapsedS)
    const state = motion.state
    renderer.draw(state, dt)
    if (hovered) {
      renderer.placeCard(state)
    }

    if (timestamp - lastOutlineAt >= OUTLINE_INTERVAL_MS) {
      lastOutlineAt = timestamp
      emit('outline', motion.outline())
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

  window.requestAnimationFrame(frame)

  window.addEventListener('resize', () => {
    // why: Once a host has spoken its announcements are authoritative and arrive on every resize; a window-measured world would briefly undo a card-scaled one.
    if (hosted) {
      return
    }
    pond = describePond(window.innerWidth, window.innerHeight, pond.reducedMotion)
    motion.setPond(pond)
    renderer.setPond(pond)
  })

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
      paused = next
    },
    connect(next) {
      emit = next
    },
  }
}
