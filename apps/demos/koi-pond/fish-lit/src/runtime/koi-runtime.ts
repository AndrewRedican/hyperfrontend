/**
 * This app's runtime: the brain, the renderer, and the loop that drives them —
 * packaged as a Lit reactive controller.
 *
 * A controller is how Lit attaches stateful behaviour to an element without
 * putting it in the element: the koi's swimming owns the animation frame, the
 * window listener and the renderer's lifetime, the element owns nothing but
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
import type { Disturbance, KoiIdentity, KoiProfile, NeighborObservation, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { ReactiveController, ReactiveControllerHost } from 'lit'
import type { KoiRuntime } from '../feature/wire-contract'
import type { GlRenderer, KoiRenderer } from '../koi/koi-render'
import { describePond, entryStation, koiProfile, koiSeed, mayRipple } from '@hyperfrontend/demo-koi-lib'
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
  /** The hover identity card. */
  card: HTMLElement
  /** The GL factory behind the canvas, replaceable so specs can run headless. */
  createGl?: (canvas: HTMLCanvasElement) => GlRenderer
}

/** How often the koi reports its outline to the host, in milliseconds. */
const OUTLINE_INTERVAL_MS = 100

/** Longest delta a single frame may report, in seconds. */
const MAX_FRAME_S = 1 / 20

/** How hard a koi breaking the surface strikes the water. */
const WAKE_STRENGTH = 0.45

/** Shortest gap between two ripple requests from this koi, in milliseconds. */
const RIPPLE_INTERVAL_MS = 700

/** Which framework this app renders. */
const FRAMEWORK = 'lit'

/** The depth level the koi enters at before any host grants it one. */
const ENTRY_DEPTH = 3

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

  /** Whether the host's pointer is over this koi. */
  #hovered = false

  /** Whether the host asked this koi to hold still. */
  #paused = false

  /** Whether a host has announced a world, making its announcements authoritative. */
  #hosted = false

  /** The animation frame in flight, or `null` while the element is disconnected. */
  #frameHandle: number | null = null

  /** Timestamp of the last outline report. */
  #lastOutlineAt = 0

  /** Timestamp of the last ripple request. */
  #lastRippleAt = 0

  /** Timestamp of the previous frame. */
  #lastFrameAt = 0

  /** Timestamp of the first frame, from which elapsed seconds are measured. */
  #startedAt = 0

  /** Whether the koi was still fleeing as of the previous frame. */
  #wasFleeing = false

  /**
   * Places a koi in its own frame and registers it with the element that shows it.
   *
   * @param host - The element whose lifecycle starts and stops the swimming.
   * @param buildRenderer - The renderer factory, replaceable so specs can run without a GPU.
   */
  constructor(host: ReactiveControllerHost, buildRenderer: KoiRendererFactory = createKoiRenderer) {
    this.#buildRenderer = buildRenderer
    // why: Standalone the host never announces a world, so the koi measures its own frame and swims in that.
    this.#pond = describePond(window.innerWidth, window.innerHeight, window.matchMedia('(prefers-reduced-motion: reduce)').matches)
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
   * @param card - The hover identity card.
   * @param createGl - The GL factory, replaceable so specs can run headless.
   */
  attach(canvas: HTMLCanvasElement, card: HTMLElement, createGl?: (canvas: HTMLCanvasElement) => GlRenderer): void {
    this.#parts = { canvas, card, createGl }
    this.#renderer = this.#buildRenderer(canvas, card, this.profile, this.#pond, createGl)
  }

  /** Starts the koi swimming and begins tracking the frame it swims in. */
  hostConnected(): void {
    // why: A re-connected element renders no `firstUpdated`, so the scene disposed at disconnect is rebuilt from the stage it already handed over.
    if (this.#parts !== null && this.#renderer === null) {
      this.attach(this.#parts.canvas, this.#parts.card, this.#parts.createGl)
    }
    this.#frameHandle = window.requestAnimationFrame(this.#frame)
    window.addEventListener('resize', this.#measure)
  }

  /** Stops the koi cleanly when its element leaves the document. */
  hostDisconnected(): void {
    if (this.#frameHandle !== null) {
      window.cancelAnimationFrame(this.#frameHandle)
      this.#frameHandle = null
    }
    window.removeEventListener('resize', this.#measure)
    this.#renderer?.dispose()
    this.#renderer = null
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
  }

  /**
   * Reacts to something striking the water.
   *
   * @param disturbance - Where the water broke and how hard.
   */
  startle(disturbance: Disturbance): void {
    this.#motion.startle(disturbance)
  }

  /**
   * Takes the host's relayed view of who is nearby.
   *
   * @param neighbors - The koi close enough to matter.
   */
  observe(neighbors: readonly NeighborObservation[]): void {
    this.#motion.observe(neighbors)
  }

  /**
   * Shows or hides this koi's own hover identity.
   *
   * @param hovered - Whether the host's pointer is over this koi.
   */
  setHovered(hovered: boolean): void {
    this.#hovered = hovered
    this.#renderer?.setHovered(hovered)
    if (hovered) {
      // why: A hover notice can land while the pond is asleep and no frame is coming, so the card is parked beside the koi at once rather than waiting on the loop.
      this.#renderer?.placeCard(this.#motion.state)
    }
  }

  /**
   * Holds still, or resumes.
   *
   * @param paused - Whether the host asked this koi to stop.
   */
  setPaused(paused: boolean): void {
    this.#paused = paused
  }

  /**
   * Hands the runtime the channel it emits on.
   *
   * @param emit - The sender the contract wiring supplies.
   */
  connect(emit: (type: string, data?: unknown) => void): void {
    this.#emit = emit
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
    if (this.#paused) {
      this.#lastFrameAt = timestamp
      return
    }
    if (this.#startedAt === 0) {
      this.#startedAt = timestamp
      this.#lastFrameAt = timestamp
    }
    const raw = (timestamp - this.#lastFrameAt) / 1000
    this.#lastFrameAt = timestamp
    const dt = raw > MAX_FRAME_S ? MAX_FRAME_S : raw
    const elapsedS = (timestamp - this.#startedAt) / 1000

    this.#motion.advance(dt, elapsedS)
    const state = this.#motion.state
    this.#renderer?.draw(state, dt)
    if (this.#hovered) {
      this.#renderer?.placeCard(state)
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
      this.#emit('outline', this.#motion.outline())
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
    }
    this.#wasFleeing = this.#motion.isFleeing
  }

  /** Re-measures the koi's own frame after the browser resized it. */
  readonly #measure = (): void => {
    // why: Once a host has spoken its announcements are authoritative and arrive on every resize; a window-measured world would briefly undo a card-scaled one.
    if (this.#hosted) {
      return
    }
    this.#adopt(describePond(window.innerWidth, window.innerHeight, this.#pond.reducedMotion))
  }
}
