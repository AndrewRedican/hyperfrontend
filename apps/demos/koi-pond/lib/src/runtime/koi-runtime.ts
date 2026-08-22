/**
 * The loop a koi swims by: its brain, its renderer, and the frames that drive
 * them.
 *
 * A koi swims whether or not a pond is listening. Standalone the SDK creates no
 * channel and nothing announces a world, so the runtime falls back to its own
 * frame, and a visitor sees a single fish swimming in clear water; the composed
 * pond is that same code path with the announcements switched on.
 *
 * What differs between the apps that swim a koi is how the fish is drawn and
 * mounted, so both the renderer and the brain are built through factories the
 * app supplies. The loop between them is the same wherever it runs, down to the
 * advancement reported with every outline and the drawing surface a koi gives
 * back while its host keeps it stood down.
 */
import type { FeatureLink, KoiRuntime } from '../contract/wire.js'
import type { KoiCardDetails, KoiMemoryState } from '../model/card.js'
import type { KoiFramework, KoiProfile, PondEnvironment } from '../model/types.js'
import type { KoiMotion, KoiMotionInit } from '../motion/koi-motion.js'
import type { KoiRenderer, KoiRendererFactory } from './koi-renderer.js'
import { wireKoiContract } from '../contract/wire.js'
import { describePond, entryStation, pondWindow } from '../geometry/virtual-pond.js'
import { mayRipple } from '../model/depth.js'
import { koiProfile, koiSeed } from '../model/traits.js'
import { createKoiMotion } from '../motion/koi-motion.js'
import { measureOwnMemory, originRelation } from './browsing-context.js'

/** How often the koi reports its outline to the host, in milliseconds. */
const OUTLINE_INTERVAL_MS = 100

/** Longest delta a single frame may report, in seconds. */
const MAX_FRAME_S = 0.1

/** Shortest gap between two of this koi's own wake ripples, in milliseconds. */
const RIPPLE_INTERVAL_MS = 700

/** How hard a koi breaking the surface strikes the water. */
const WAKE_STRENGTH = 0.45

/** The depth level a koi enters the pond at. */
const ENTRY_DEPTH = 3

/** How gently a koi holding its position sculls, in body lengths per second. */
const SCULL_BL_S = 0.08

/** How often the held koi's card rows are rewritten, in milliseconds. */
const CARD_REFRESH_MS = 500

/** How often the held koi's memory is re-measured, in milliseconds. */
const MEMORY_INTERVAL_MS = 10_000

/** How many points of predicted advancement travel with an outline. */
const PATH_POINTS = 20

/** The seconds between two points of predicted advancement. */
const PATH_STEP_S = 0.1

/** How long each koi of a waking shoal waits behind the ordinal before it, in milliseconds. */
const WAKE_STAGGER_MS = 60

/** How a runtime builds its brain, replaceable so an app can bias the judgement its koi swims by. */
export type KoiMotionFactory = (init: KoiMotionInit) => KoiMotion

/** Everything a koi's runtime is born with. */
export interface KoiRuntimeInit {
  /** Which framework's koi this runtime swims. */
  framework: KoiFramework
  /** The element the koi is drawn into. */
  root: HTMLElement
  /** The channel the koi speaks the pond's contract over. */
  link: FeatureLink
  /** How to build the renderer that draws the koi. */
  rendererFactory: KoiRendererFactory
  /** Whether a host embeds this app, as the runtime that mounted it reports rather than as the window above it suggests. */
  hosted?: boolean
  /** How to build the brain the koi swims by; the shared judgement by default. */
  motionFactory?: KoiMotionFactory
}

/**
 * Creates a koi's runtime, binds it to the contract, and starts it swimming.
 *
 * @param init - The framework it swims, where to draw it, the channel it speaks over, and how to build its parts.
 * @returns The runtime, for an app that wants to drive or dispose it itself.
 *
 * @example Booting a koi
 * ```typescript
 * const koi = createKoiRuntime({ framework: 'vanilla', root, link: feature, rendererFactory: createKoiRenderer })
 * ```
 *
 * @example Leaning the shared judgement without forking it
 * ```typescript
 * const motionFactory = (born) => createKoiMotion(born, { onDecision: (decision) => report(decision.cause) })
 * const koi = createKoiRuntime({ framework: 'lit', root, link: feature, rendererFactory, motionFactory })
 * ```
 */
export function createKoiRuntime(init: KoiRuntimeInit): KoiRuntime {
  const { framework, root, rendererFactory } = init
  const profile: KoiProfile = koiProfile(framework)
  const buildMotion: KoiMotionFactory = init.motionFactory ?? createKoiMotion
  // why: The koi may be framed from a sub-path of the pond or served at its own origin's root, so the identity a visitor reads is resolved from wherever this page actually is.
  const url = new URL('.', window.location.href).href

  // why: Standalone the host never announces a world, so the koi takes the same screen snapshot the host would: the virtual pond derives from the screen, and the frame only decides how much of it shows.
  let pond: PondEnvironment = describePond(
    window.screen.width,
    window.screen.height,
    window.innerWidth,
    window.innerHeight,
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  const entry = entryStation(pond, koiSeed(framework))
  const motion = buildMotion({ profile, pond, position: entry.position, heading: entry.heading, depth: ENTRY_DEPTH })
  let renderer: KoiRenderer | null = rendererFactory(root, profile, url, pond)

  let emit: (type: string, data?: unknown) => void = () => {}
  let hosted = init.hosted === true
  let paused = false
  let held = false
  let resting = false
  let hovered = false
  let disposed = false
  let instance = 0
  let frameHandle = 0
  let wakeHandle = 0
  let lastOutlineAt = 0
  let lastFrameAt = 0
  let wasFleeing = false
  let lastRippleAt = 0
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

  /** Takes whatever the browser is willing to attribute to this frame. */
  const readMemory = async (): Promise<void> => {
    const reading = await measureOwnMemory(url)
    memoryBytes = reading.bytes
    memoryState = reading.state
  }

  /** The live facts the card renders. */
  const cardDetails = (): KoiCardDetails => {
    const state = motion.state
    return {
      held,
      phase: state.phase,
      speedBL: pond.fishLength === 0 ? 0 : state.speed / pond.fishLength,
      neighbours: neighbourCount,
      hosted,
      origin: originRelation(hosted),
      uptimeS: performance.now() / 1000,
      fps: fpsEma === 0 ? null : fpsEma,
      memoryBytes,
      memoryState,
      lastEvent: lastEvent === null ? null : { kind: lastEvent.kind, ageS: (performance.now() - lastEvent.at) / 1000 },
    }
  }

  /** Starts everything that exists only to power the held koi's card. */
  const openInspector = (): void => {
    renderer?.updateCard(cardDetails())
    cardTimer = window.setInterval(() => {
      renderer?.updateCard(cardDetails())
    }, CARD_REFRESH_MS)
    void readMemory()
    memoryTimer = window.setInterval(() => {
      void readMemory()
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

    if (!held) {
      motion.advance(dt)
    }
    const state = motion.state
    // why: A koi holding its position keeps sculling gently: a mesh frozen mid-beat reads as a rendering fault, not as a fish waiting where it was put.
    renderer?.draw(held ? { ...state, speed: state.length * SCULL_BL_S } : state, dt)
    // why: A rest is a hold nobody is inspecting, so it costs the chrome and the readings behind it nothing at all.
    if (held && !resting) {
      renderer?.placeCard(state)
      if (dt > 0) {
        // why: The card's rate is this app's own render cadence, smoothed just enough to read, and only metered while someone is actually looking.
        fpsEma = fpsEma === 0 ? 1 / dt : fpsEma + (1 / dt - fpsEma) * 0.1
      }
    }

    if (timestamp - lastOutlineAt >= OUTLINE_INTERVAL_MS) {
      lastOutlineAt = timestamp
      // why: The host dead-reckons outlines forward by reported speed, so a koi holding its position must report itself stationary or its hover target slides away from its body, and a fish going nowhere has neither an intent nor an advancement worth drawing.
      const outline = held
        ? { ...motion.outline(), speed: 0, intent: undefined }
        : { ...motion.outline(), path: motion.predictPath(PATH_POINTS, PATH_STEP_S) }
      // why: This frame is pointer-transparent, so the card's links can only be opened by the host: the outline carries the card's geometry whenever a visitor holds this koi.
      const card = renderer?.cardRects() ?? null
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
      emit('settled', { framework })
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

  /** Stands the koi down: the loop stops and the frame gives its drawing surface back. */
  const standDown = (): void => {
    window.clearTimeout(wakeHandle)
    wakeHandle = 0
    stop()
    // why: A hidden koi's GL context and drawing buffers are the largest thing its frame can hand back, and only the host that hid it decides when they are built again.
    renderer?.dispose()
    renderer = null
  }

  /** Stands the koi back up, its own ordinal's turn behind the koi before it. */
  const standUp = (): void => {
    // why: A whole shoal waking at once would create every GL context in one frame, so each koi waits out the ordinal it was given before it builds its own.
    wakeHandle = window.setTimeout(() => {
      wakeHandle = 0
      const view = rendererFactory(root, profile, url, pond)
      renderer = view
      view.setHovered(hovered)
      view.setSelected(held && !resting)
      start()
    }, instance * WAKE_STAGGER_MS)
  }

  const onResize = (): void => {
    // why: A hosted koi's view is the host's to announce, and it announces one on every resize; a window-measured view would briefly undo the host's.
    if (hosted) {
      return
    }
    // why: Only the visible window follows the frame: the virtual pond took its dimensions from the screen at startup and never moves under the fish.
    pond = { ...pond, view: pondWindow(pond, window.innerWidth, window.innerHeight) }
    motion.setPond(pond)
    renderer?.setPond(pond)
  }

  // why: `pagehide` fires for two opposite things, and only one of them is the end. A page frozen into the back/forward cache is coming back, and a koi disposed on the way in never returns: its GL context is released and the loop is latched shut for good, while the channel it shares with the host keeps answering beats. The host would see a perfectly healthy session over a hole in the water, the one failure no watchdog can catch. Only a page that is not coming back is torn down.
  const onPageHide = (event: PageTransitionEvent): void => {
    if (event.persisted) {
      stop()
      return
    }
    dispose()
  }

  // why: Restores the koi the cache handed back. The host resumes a sleeping shoal on its own, so a koi it deliberately paused must not swim itself awake here.
  const onPageShow = (event: PageTransitionEvent): void => {
    if (event.persisted && !paused) {
      start()
    }
  }

  const dispose = (): void => {
    if (disposed) {
      return
    }
    disposed = true
    standDown()
    closeInspector()
    window.removeEventListener('resize', onResize)
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('pageshow', onPageShow)
  }

  const runtime: KoiRuntime = {
    setPond(next) {
      hosted = true
      pond = next
      motion.setPond(next)
      renderer?.setPond(next)
    },
    adopt(identity) {
      // why: A shoal stood back up together builds its GL contexts one ordinal at a time, so a koi keeps the ordinal that says when its own turn comes.
      instance = identity.instance
      motion.setDepth(identity.depth)
    },
    setDepth(level) {
      motion.setDepth(level)
      noteEvent('depth-grant')
    },
    startle(disturbance) {
      motion.startle(disturbance)
      noteEvent('disturbance')
    },
    observe(neighbors) {
      motion.observe(neighbors)
      neighbourCount = neighbors.length
    },
    setHovered(next) {
      hovered = next
      renderer?.setHovered(next)
    },
    setPaused(next) {
      if (next === paused) {
        return
      }
      // why: A sleeping koi cancels its animation frame outright: a shoal of hidden frames each still waking per frame is exactly the battery cost the host's sleep exists to remove.
      paused = next
      if (paused) {
        standDown()
      } else {
        standUp()
      }
    },
    setInspected(next, restful) {
      if (next === held && restful === resting) {
        return
      }
      held = next
      resting = restful
      // why: A rest is a hold nobody reached for: the koi holds its position and its scull, and shows none of the chrome an inspection would open.
      const inspecting = next && !restful
      renderer?.setSelected(inspecting)
      if (inspecting) {
        renderer?.placeCard(motion.state)
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

  start()
  window.addEventListener('resize', onResize)
  // why: The frame's GL context and callbacks should not outlive the page: a torn-down koi must leave nothing running.
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('pageshow', onPageShow)
  // why: The runtime speaks the contract for itself, so one call is the whole of what an app needs to have a koi that swims, reports, and answers its pond.
  wireKoiContract(init.link, runtime)

  return runtime
}
