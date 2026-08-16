/**
 * This app's runtime: the brain, the renderer, and the loop that drives them.
 *
 * The koi swims whether or not a pond is listening. Opened directly in a tab
 * the SDK creates no channel at all, so `send` is a no-op and nothing ever
 * announces a world — the runtime falls back to its own frame, and a visitor
 * who opens `/fish-solid/` sees one koi swimming in clear water. That is the
 * standalone story every fish app in the pond keeps.
 */
import type {
  Disturbance,
  KoiCardDetails,
  KoiIdentity,
  KoiMemoryState,
  KoiProfile,
  NeighborObservation,
  PondEnvironment,
} from '@hyperfrontend/demo-koi-lib'
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

/** Shortest gap between two ripple requests, in milliseconds. */
const RIPPLE_INTERVAL_MS = 700

/** How hard a koi breaking the surface strikes the water. */
const WAKE_STRENGTH = 0.45

/** The depth level the koi holds until the host grants it another. */
const OPENING_DEPTH = 3

/** How often the held koi's card rows are rewritten, in milliseconds. */
const CARD_REFRESH_MS = 500

/** How often the held koi's memory is re-measured, in milliseconds. */
const MEMORY_INTERVAL_MS = 10_000

/** Which framework this app renders. */
const FRAMEWORK = 'solid'

/** The slice of the memory-measurement API this runtime feels for. */
interface MemoryMeasurer {
  measureUserAgentSpecificMemory?: () => Promise<{
    breakdown: { bytes: number; attribution: { url?: string }[] }[]
  }>
}

/**
 * How this app's origin relates to the page embedding it.
 *
 * @returns The relation, or `null` when the app is its own top page.
 */
function originRelation(): 'same-origin' | 'cross-origin' | null {
  if (window.parent === window) {
    return null
  }
  try {
    return new URL(document.referrer).origin === window.location.origin ? 'same-origin' : 'cross-origin'
  } catch {
    return 'cross-origin'
  }
}

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
  // why: Standalone the host never announces a world, so the koi takes the same screen snapshot the host would — the virtual pond derives from the screen, and the frame only decides how much of it shows.
  let pond: PondEnvironment = describePond(
    window.screen.width,
    window.screen.height,
    window.innerWidth,
    window.innerHeight,
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  const entry = entryStation(pond, koiSeed(FRAMEWORK))
  const motion = createKoiMotion({ profile, pond, position: entry.position, heading: entry.heading, depth: OPENING_DEPTH })
  // why: The koi may be framed from a sub-path of the pond or served at its own origin's root, so the identity a visitor reads is resolved from wherever this page actually is.
  const renderer = buildRenderer(root, profile, new URL('.', window.location.href).href, pond)

  let emit: (type: string, data?: unknown) => void = () => {}
  let paused = false
  let inspected = false
  let hosted = false
  let disposed = false
  let frameHandle = 0
  let lastOutlineAt = 0
  let lastFrameAt = 0
  let wasFleeing = false
  let lastRippleAt = 0

  const origin = originRelation()
  let neighbourCount = 0
  let lastEvent: { kind: string; at: number } | null = null
  let fpsEma = 0
  let memoryBytes: number | null = null
  let memoryState: KoiMemoryState = 'pending'
  let cardTimer = 0
  let memoryTimer = 0

  /** Remembers the newest coordination event for the card's story. */
  const noteEvent = (kind: string): void => {
    lastEvent = { kind, at: performance.now() }
  }

  /**
   * Measures this app's own memory, honestly or not at all.
   *
   * `performance.measureUserAgentSpecificMemory` only runs in cross-origin
   * isolated pages and attributes per browsing context; this frame keeps the
   * breakdown entries attributed to its own directory and refuses to guess when
   * the API, the isolation, or the attribution is missing. A failed measurement
   * can never disturb the koi — everything lands in the card and nowhere else.
   */
  const measureMemory = async (): Promise<void> => {
    try {
      const measurer = (<MemoryMeasurer>performance).measureUserAgentSpecificMemory
      if (measurer === undefined || !window.crossOriginIsolated) {
        memoryState = 'unavailable'
        return
      }
      const result = await measurer.call(performance)
      const own = new URL('.', window.location.href).href
      let bytes = 0
      let attributed = false
      for (const entry of result.breakdown) {
        if (entry.attribution.some((source) => typeof source.url === 'string' && source.url.startsWith(own))) {
          bytes += entry.bytes
          attributed = true
        }
      }
      memoryBytes = attributed ? bytes : null
      memoryState = attributed ? 'measured' : 'unavailable'
    } catch {
      memoryState = 'unavailable'
    }
  }

  /** The live facts the card renders. */
  const cardDetails = (): KoiCardDetails => {
    const state = motion.state
    return {
      held: inspected,
      phase: state.phase,
      speedBL: pond.fishLength === 0 ? 0 : state.speed / pond.fishLength,
      neighbours: neighbourCount,
      hosted,
      origin: hosted ? origin : null,
      uptimeS: performance.now() / 1000,
      fps: fpsEma === 0 ? null : fpsEma,
      memoryBytes,
      memoryState,
      lastEvent: lastEvent === null ? null : { kind: lastEvent.kind, ageS: (performance.now() - lastEvent.at) / 1000 },
    }
  }

  /** Starts everything that exists only to power the held koi's card. */
  const openInspector = (): void => {
    renderer.updateCard(cardDetails())
    cardTimer = window.setInterval(() => {
      renderer.updateCard(cardDetails())
    }, CARD_REFRESH_MS)
    void measureMemory()
    memoryTimer = window.setInterval(() => {
      void measureMemory()
    }, MEMORY_INTERVAL_MS)
  }

  /** Tears the card's machinery down the moment the koi is released. */
  const closeInspector = (): void => {
    window.clearInterval(cardTimer)
    window.clearInterval(memoryTimer)
    cardTimer = 0
    memoryTimer = 0
    fpsEma = 0
  }

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
    if (inspected) {
      renderer.placeCard(state)
      if (dt > 0) {
        // why: The card's rate is this app's own render cadence, smoothed just enough to read — and only metered while someone is actually looking.
        fpsEma = fpsEma === 0 ? 1 / dt : fpsEma + (1 / dt - fpsEma) * 0.1
      }
    }

    if (timestamp - lastOutlineAt >= OUTLINE_INTERVAL_MS) {
      lastOutlineAt = timestamp
      // why: The host dead-reckons outlines forward by reported speed, so a held koi must report itself stationary or its hover target slides away from its body — and a fish going nowhere has no intent for the overlay to draw.
      const outline = inspected ? { ...motion.outline(), speed: 0, intent: undefined } : motion.outline()
      // why: This frame is pointer-transparent, so the card's links can only be opened by the host — the outline carries the card's geometry whenever a visitor holds this koi.
      const card = renderer.cardRects()
      emit('outline', card === null ? outline : { ...outline, card })
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
      noteEvent('settled')
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
    closeInspector()
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
      noteEvent('depth-grant')
    },
    startle(disturbance: Disturbance) {
      motion.startle(disturbance)
      noteEvent('disturbance')
    },
    observe(neighbors: readonly NeighborObservation[]) {
      motion.observe(neighbors)
      neighbourCount = neighbors.length
    },
    setHovered(next) {
      renderer.setHovered(next)
    },
    setPaused(next) {
      // why: A sleeping koi cancels its animation frame outright — eight hidden frames each still waking per frame is exactly the battery cost the host's sleep exists to remove.
      paused = next
      if (paused) {
        stop()
      } else {
        start()
      }
    },
    setInspected(next) {
      if (next === inspected) {
        return
      }
      inspected = next
      renderer.setSelected(next)
      if (next) {
        renderer.placeCard(motion.state)
        openInspector()
      } else {
        closeInspector()
      }
    },
    placeAt(point) {
      motion.place(point)
      noteEvent('place')
    },
    dispose,
    connect(next) {
      emit = next
    },
  }
}
