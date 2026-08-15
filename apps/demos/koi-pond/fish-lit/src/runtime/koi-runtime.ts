/**
 * This app's runtime: the brain, the renderer, and the loop that drives them —
 * packaged as a Lit reactive controller.
 *
 * A controller is how Lit attaches stateful behaviour to an element without
 * putting it in the element: the koi's swimming owns the animation frame, the
 * window listeners and the renderer's lifetime, the element owns nothing but
 * its template, and the component's own lifecycle is what starts and stops the
 * fish. The loop never asks the element to re-render — it advances the brain
 * and hands each frame to the renderer, which writes the scene directly.
 *
 * The koi swims whether or not a pond is listening. Opened directly in a tab
 * the SDK creates no channel at all, so `send` is a no-op and nothing ever
 * announces a world — the controller falls back to its own frame, and a visitor
 * who opens `/fish-lit/` sees one koi swimming in clear water. That is the
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
  Vec2,
} from '@hyperfrontend/demo-koi-lib'
import type { ReactiveController, ReactiveControllerHost } from 'lit'
import type { KoiRuntime } from '../feature/wire-contract'
import type { GlRenderer, KoiRenderer } from '../koi/koi-render'
import { describePond, entryStation, koiProfile, koiSeed, mayRipple, pondWindow } from '@hyperfrontend/demo-koi-lib'
import { KoiMotion } from '../koi/koi-motion'
import { createKoiRenderer } from '../koi/koi-render'

/** How a runtime builds its renderer, replaceable so specs can run without a GPU. */
export type KoiRendererFactory = (
  canvas: HTMLCanvasElement,
  card: HTMLElement,
  profile: KoiProfile,
  pond: PondEnvironment,
  createGl?: (canvas: HTMLCanvasElement) => GlRenderer
) => KoiRenderer

/** The stage the element hands over once its template has rendered. */
interface KoiStageParts {
  /** The canvas the koi is drawn onto. */
  canvas: HTMLCanvasElement
  /** The identity card. */
  card: HTMLElement
  /** The GL factory behind the canvas, replaceable so specs can run headless. */
  createGl?: (canvas: HTMLCanvasElement) => GlRenderer
}

/** How often the koi reports its outline to the host, in milliseconds. */
const OUTLINE_INTERVAL_MS = 100

/** Longest delta a single frame may report, in seconds. */
const MAX_FRAME_S = 0.1

/** How hard a koi breaking the surface strikes the water. */
const WAKE_STRENGTH = 0.45

/** Shortest gap between two ripple requests from this koi, in milliseconds. */
const RIPPLE_INTERVAL_MS = 700

/** How often the held koi's card rows are rewritten, in milliseconds. */
const CARD_REFRESH_MS = 500

/** How often the held koi's memory is re-measured, in milliseconds. */
const MEMORY_INTERVAL_MS = 10_000

/** Which framework this app renders. */
const FRAMEWORK = 'lit'

/** The depth level the koi enters at before any host grants it one. */
const ENTRY_DEPTH = 3

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
 * The koi's swimming, bound to the lifecycle of the element that shows it.
 *
 * @example Attaching the koi to a component
 * ```typescript
 * class KoiFishElement extends LitElement {
 *   readonly swim = new KoiSwimController(this)
 * }
 * ```
 */
export class KoiSwimController implements ReactiveController, KoiRuntime {
  /** Everything about this koi that never changes. */
  readonly profile: KoiProfile = koiProfile(FRAMEWORK)

  /** The koi's brain. */
  readonly #motion: KoiMotion

  /** How this controller builds its renderer, replaceable so specs can run without a GPU. */
  readonly #buildRenderer: KoiRendererFactory

  /** The world it swims in; measured from its own frame until a host announces one. */
  #pond: PondEnvironment

  /** The stage the element handed over, or `null` before its template rendered. */
  #parts: KoiStageParts | null = null

  /** The renderer drawing the koi, or `null` while the element is off the page. */
  #renderer: KoiRenderer | null = null

  /** The channel it reports on, replaced once the contract wiring connects one. */
  #emit: (type: string, data?: unknown) => void = () => {}

  /** Whether the host asked this koi to hold still. */
  #paused = false

  /** Whether the host is holding this koi in place for inspection. */
  #inspected = false

  /** Whether a host has announced a world, making its announcements authoritative. */
  #hosted = false

  /** Whether the koi has been torn down for good; a disposed koi never restarts. */
  #disposed = false

  /** The animation frame in flight, or `null` while the loop is stopped. */
  #frameHandle: number | null = null

  /** Timestamp of the last outline report. */
  #lastOutlineAt = 0

  /** Timestamp of the last ripple request. */
  #lastRippleAt = 0

  /** Timestamp of the previous frame. */
  #lastFrameAt = 0

  /** Whether the koi was still fleeing as of the previous frame. */
  #wasFleeing = false

  /** How this app's origin relates to the page embedding it, or `null` as its own top page. */
  readonly #origin = originRelation()

  /** How many neighbours the host most recently relayed. */
  #neighbourCount = 0

  /** The most recent coordination event this app took part in, or `null`. */
  #lastEvent: { kind: string; at: number } | null = null

  /** This app's own render rate, smoothed, metered only while someone is looking. */
  #fpsEma = 0

  /** Memory attributed to this app's own browsing context, in bytes, when measured. */
  #memoryBytes: number | null = null

  /** How the memory reading stands. */
  #memoryState: KoiMemoryState = 'pending'

  /** The interval rewriting the held koi's card rows, or 0 while released. */
  #cardTimer = 0

  /** The interval re-measuring the held koi's memory, or 0 while released. */
  #memoryTimer = 0

  /**
   * Places a koi in its own frame and registers it with the element that shows it.
   *
   * @param host - The element whose lifecycle starts and stops the swimming.
   * @param buildRenderer - The renderer factory, replaceable so specs can run without a GPU.
   */
  constructor(host: ReactiveControllerHost, buildRenderer: KoiRendererFactory = createKoiRenderer) {
    this.#buildRenderer = buildRenderer
    // why: Standalone the host never announces a world, so the koi takes the same screen snapshot the host would — the virtual pond derives from the screen, and the frame only decides how much of it shows.
    this.#pond = describePond(
      window.screen.width,
      window.screen.height,
      window.innerWidth,
      window.innerHeight,
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
    const entry = entryStation(this.#pond, koiSeed(FRAMEWORK))
    this.#motion = new KoiMotion({
      profile: this.profile,
      pond: this.#pond,
      position: entry.position,
      heading: entry.heading,
      depth: ENTRY_DEPTH,
    })
    host.addController(this)
  }

  /** The renderer drawing the koi, exposed for debug overlays and specs. */
  get renderer(): KoiRenderer | null {
    return this.#renderer
  }

  /**
   * Takes the canvas and card the element's template rendered and builds the scene behind them.
   *
   * @param canvas - The canvas the koi is drawn onto.
   * @param card - The identity card.
   * @param createGl - The GL factory, replaceable so specs can run headless.
   */
  attach(canvas: HTMLCanvasElement, card: HTMLElement, createGl?: (canvas: HTMLCanvasElement) => GlRenderer): void {
    this.#parts = { canvas, card, createGl }
    this.#renderer = this.#buildRenderer(canvas, card, this.profile, this.#pond, createGl)
  }

  /** Starts the koi swimming and begins tracking the frame and the page it swims in. */
  hostConnected(): void {
    // why: A re-connected element renders no `firstUpdated`, so the scene disposed at disconnect is rebuilt from the stage it already handed over.
    if (this.#parts !== null && this.#renderer === null) {
      this.attach(this.#parts.canvas, this.#parts.card, this.#parts.createGl)
    }
    this.#start()
    window.addEventListener('resize', this.#measure)
    // why: The frame's GL context and callbacks should not outlive the page — a torn-down koi must leave nothing running.
    window.addEventListener('pagehide', this.#onPagehide)
  }

  /** Stops the koi cleanly when its element leaves the document. */
  hostDisconnected(): void {
    // why: A disconnected element may come back, so this is the reversible half of dispose — the same teardown without the terminal latch.
    this.#teardown()
  }

  /**
   * Adopts a newly announced world.
   *
   * @param pond - The world the host measured.
   */
  setPond(pond: PondEnvironment): void {
    this.#hosted = true
    this.#adopt(pond)
  }

  /**
   * Takes the identity the host assigned at open.
   *
   * @param identity - Who this koi is, and where it starts.
   */
  adopt(identity: KoiIdentity): void {
    this.#motion.setDepth(identity.depth)
  }

  /**
   * Takes a granted depth level.
   *
   * @param level - The level the host granted.
   */
  setDepth(level: number): void {
    this.#motion.setDepth(level)
    this.#noteEvent('depth-grant')
  }

  /**
   * Reacts to something striking the water.
   *
   * @param disturbance - Where the water broke and how hard.
   */
  startle(disturbance: Disturbance): void {
    this.#motion.startle(disturbance)
    this.#noteEvent('disturbance')
  }

  /**
   * Takes the host's relayed view of who is nearby.
   *
   * @param neighbors - The koi close enough to matter.
   */
  observe(neighbors: readonly NeighborObservation[]): void {
    this.#motion.observe(neighbors)
    this.#neighbourCount = neighbors.length
  }

  /**
   * Marks whether the host's pointer is over this koi, which only shades its silhouette.
   *
   * @param hovered - Whether the host's pointer is over this koi.
   */
  setHovered(hovered: boolean): void {
    this.#renderer?.setHovered(hovered)
  }

  /**
   * Holds still, or resumes.
   *
   * @param paused - Whether the host asked this koi to stop.
   */
  setPaused(paused: boolean): void {
    // why: A sleeping koi cancels its animation frame outright — eight hidden frames each still waking per frame is exactly the battery cost the host's sleep exists to remove.
    this.#paused = paused
    if (this.#paused) {
      this.#stop()
    } else {
      this.#start()
    }
  }

  /**
   * Holds position for inspection while sculling in place, or resumes swimming.
   *
   * @param inspected - Whether the host is presenting this koi to the visitor.
   */
  setInspected(inspected: boolean): void {
    if (inspected === this.#inspected) {
      return
    }
    this.#inspected = inspected
    this.#renderer?.setSelected(inspected)
    if (inspected) {
      this.#renderer?.placeCard(this.#motion.state)
      this.#openInspector()
    } else {
      this.#closeInspector()
    }
  }

  /**
   * Carries the held koi to a pond point while a visitor drags it.
   *
   * @param point - Where the koi's nose is being carried, in pond space.
   */
  placeAt(point: Vec2): void {
    this.#motion.place(point)
    this.#noteEvent('place')
  }

  /** Stops the loop and releases everything the koi holds, once and for good. */
  dispose(): void {
    if (this.#disposed) {
      return
    }
    this.#disposed = true
    this.#teardown()
  }

  /**
   * Hands the runtime the channel it emits on.
   *
   * @param emit - The sender the contract wiring supplies.
   */
  connect(emit: (type: string, data?: unknown) => void): void {
    this.#emit = emit
  }

  /** Stops the loop entirely; a stopped koi costs nothing, not even a callback. */
  #stop(): void {
    if (this.#frameHandle !== null) {
      window.cancelAnimationFrame(this.#frameHandle)
      this.#frameHandle = null
    }
  }

  /** Starts the loop with a fresh clock, so the first frame back reports no false gap. */
  #start(): void {
    if (this.#frameHandle === null && !this.#disposed) {
      this.#lastFrameAt = 0
      this.#frameHandle = window.requestAnimationFrame(this.#frame)
    }
  }

  /** Cancels the loop, unhooks the window, closes the inspector, and releases the renderer's GPU hold. */
  #teardown(): void {
    this.#stop()
    this.#closeInspector()
    window.removeEventListener('resize', this.#measure)
    window.removeEventListener('pagehide', this.#onPagehide)
    this.#renderer?.dispose()
    this.#renderer = null
  }

  /**
   * Remembers the newest coordination event for the card's story.
   *
   * @param kind - The event kind the card names.
   */
  #noteEvent(kind: string): void {
    this.#lastEvent = { kind, at: performance.now() }
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
  async #measureMemory(): Promise<void> {
    try {
      const measurer = (performance as MemoryMeasurer).measureUserAgentSpecificMemory
      if (measurer === undefined || !window.crossOriginIsolated) {
        this.#memoryState = 'unavailable'
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
      this.#memoryBytes = attributed ? bytes : null
      this.#memoryState = attributed ? 'measured' : 'unavailable'
    } catch {
      this.#memoryState = 'unavailable'
    }
  }

  /**
   * The live facts the card renders.
   *
   * @returns The details the renderer derives its rows from.
   */
  #cardDetails(): KoiCardDetails {
    const state = this.#motion.state
    return {
      held: this.#inspected,
      phase: state.phase,
      speedBL: this.#pond.fishLength === 0 ? 0 : state.speed / this.#pond.fishLength,
      neighbours: this.#neighbourCount,
      hosted: this.#hosted,
      origin: this.#hosted ? this.#origin : null,
      uptimeS: performance.now() / 1000,
      fps: this.#fpsEma === 0 ? null : this.#fpsEma,
      memoryBytes: this.#memoryBytes,
      memoryState: this.#memoryState,
      lastEvent: this.#lastEvent === null ? null : { kind: this.#lastEvent.kind, ageS: (performance.now() - this.#lastEvent.at) / 1000 },
    }
  }

  /** Starts everything that exists only to power the held koi's card. */
  #openInspector(): void {
    this.#renderer?.updateCard(this.#cardDetails())
    this.#cardTimer = window.setInterval(() => {
      this.#renderer?.updateCard(this.#cardDetails())
    }, CARD_REFRESH_MS)
    void this.#measureMemory()
    this.#memoryTimer = window.setInterval(() => {
      void this.#measureMemory()
    }, MEMORY_INTERVAL_MS)
  }

  /** Tears the card's machinery down the moment the koi is released. */
  #closeInspector(): void {
    window.clearInterval(this.#cardTimer)
    window.clearInterval(this.#memoryTimer)
    this.#cardTimer = 0
    this.#memoryTimer = 0
    this.#fpsEma = 0
  }

  /**
   * Hands a world to everything that steers or draws by it.
   *
   * @param pond - The world to swim in.
   */
  #adopt(pond: PondEnvironment): void {
    this.#pond = pond
    this.#motion.setPond(pond)
    this.#renderer?.setPond(pond)
  }

  /**
   * Advances the koi one animation frame and draws it.
   *
   * @param timestamp - The frame's high-resolution timestamp.
   */
  readonly #frame = (timestamp: number): void => {
    this.#frameHandle = window.requestAnimationFrame(this.#frame)
    if (this.#lastFrameAt === 0) {
      this.#lastFrameAt = timestamp
    }
    const raw = (timestamp - this.#lastFrameAt) / 1000
    this.#lastFrameAt = timestamp
    const dt = raw > MAX_FRAME_S ? MAX_FRAME_S : raw

    if (!this.#inspected) {
      this.#motion.advance(dt)
    }
    const state = this.#motion.state
    // why: An inspected koi holds its position but keeps sculling gently — a mesh frozen mid-beat reads as a rendering fault, not a fish waiting to be looked at.
    this.#renderer?.draw(this.#inspected ? { ...state, speed: state.length * 0.08 } : state, dt)
    if (this.#inspected) {
      this.#renderer?.placeCard(state)
      if (dt > 0) {
        // why: The card's rate is this app's own render cadence, smoothed just enough to read — and only metered while someone is actually looking.
        this.#fpsEma = this.#fpsEma === 0 ? 1 / dt : this.#fpsEma + (1 / dt - this.#fpsEma) * 0.1
      }
    }
    this.#report(timestamp)
  }

  /**
   * Tells the host where this koi is and what it would like.
   *
   * @param timestamp - The frame's high-resolution timestamp.
   */
  #report(timestamp: number): void {
    const state = this.#motion.state
    if (timestamp - this.#lastOutlineAt >= OUTLINE_INTERVAL_MS) {
      this.#lastOutlineAt = timestamp
      // why: The host dead-reckons outlines forward by reported speed, so a held koi must report itself stationary or its hover target slides away from its body — and a fish going nowhere has no intent for the overlay to draw.
      const outline = this.#inspected ? { ...this.#motion.outline(), speed: 0, intent: undefined } : this.#motion.outline()
      // why: This frame is pointer-transparent, so the card's links can only be opened by the host — the outline carries the card's geometry whenever a visitor holds this koi.
      const card = this.#renderer?.cardRects() ?? null
      this.#emit('outline', card === null ? outline : { ...outline, card })
      const requested = this.#motion.takeDepthRequest()
      if (requested !== null) {
        this.#emit('depth-request', { level: requested })
      }
      // why: Only the koi just under the surface may ask for a ripple, and only while it is moving hard enough to actually break it.
      if (mayRipple(state.depth) && state.speed > state.length && timestamp - this.#lastRippleAt > RIPPLE_INTERVAL_MS) {
        this.#lastRippleAt = timestamp
        this.#emit('ripple-request', { x: state.position.x, y: state.position.y, strength: WAKE_STRENGTH })
      }
    }

    if (this.#wasFleeing && !this.#motion.isFleeing) {
      // why: The host waits for every koi to report itself settled before it calls a disturbance sequence complete.
      this.#emit('settled', { framework: FRAMEWORK })
      this.#noteEvent('settled')
    }
    this.#wasFleeing = this.#motion.isFleeing
  }

  /** Re-measures the koi's own frame after the browser resized it. */
  readonly #measure = (): void => {
    // why: Once a host has spoken its announcements are authoritative and arrive on every resize; a window-measured view would briefly undo the host's.
    if (this.#hosted) {
      return
    }
    // why: Only the visible window follows the frame — the virtual pond took its dimensions from the screen at startup and never moves under the fish.
    this.#adopt({ ...this.#pond, view: pondWindow(this.#pond, window.innerWidth, window.innerHeight) })
  }

  /** Tears the koi down for good as the page goes away. */
  readonly #onPagehide = (): void => {
    this.dispose()
  }
}
