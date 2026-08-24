/**
 * The pond scene: everything the host owns, assembled.
 *
 * The bed, the surface water, the pointer, the depth order, the curtain, the
 * shoal panel, the decision overlay, and one channel per swimming koi. Every koi is
 * a separate application in a separate frame; this module's whole job is to
 * make those read as one continuous scene, and to keep the seams — the relay,
 * the depth grants, the ripple gate — on the host's side of the boundary where
 * they belong. Sessions key by instance, never by framework: two koi of one
 * framework are two fish, each with its own layer, depth, chrome, and budget.
 */
import type { KoiFramework, KoiOutline, Vec2 } from '@hyperfrontend/demo-koi-lib'
import type { PondScene, SceneScale } from '../feature/wire-contract'
import type { DeviceTier } from '../runtime/device-tier'
import type { KoiInstanceId } from './instance-id'
import type { KoiSighting } from './interactions'
import type { KoiSession } from './koi-sessions'
import { KOI_FRAMEWORKS, describePond, describePondForFrame, mayRipple, pondPoint, pondWindow } from '@hyperfrontend/demo-koi-lib'
import { openingShoal, readDeviceProfile } from '../runtime/device-tier'
import { createDepthDirector } from './depth-director'
import { createFrameLoop } from './raf-loop'
import { createInteractionsPainter } from './interactions'
import { createRelay } from './relay'
import { createResurrection } from './resurrection'
import { createSelectionChrome } from './selection'
import { createShoalPanel } from './roster'
import { createSequenceTracker } from './sequence'
import { createStage, removeLayer, reseatSurface, setCurtain, setLayerDepth, setLayerPresent } from './stage'
import { createSurfacePainter } from './surface-canvas'
import { createVisibilityWatch } from './visibility'
import { createWaterPainter } from './water-gl'
import { acceptsRipple, addRipple, advanceRipples, createRippleField } from './ripples'
import { fishHomeUrl, identityFor, openInstance } from './koi-sessions'
import { instanceFramework, nextOrdinal } from './instance-id'
import { paintFloor } from './floor'

/** How often the host relays each koi its neighbours, in milliseconds. */
const RELAY_INTERVAL_MS = 120

/** How hard a pointer press strikes the water. */
const POINTER_STRENGTH = 1

/** Longest the curtain waits for the last koi before revealing the pond anyway. */
const CURTAIN_DEADLINE_MS = 5000

/** How opaque the pond's own paint is when it runs as a layer over a host page. */
const OVERLAY_FLOOR_ALPHA = 0.7

/** How long the water waits for a browser to give its context back before hanging a new canvas, in milliseconds. */
// why: Restoring the context the page already has is much the better outcome — the canvas stays, nothing is rebuilt twice — and a browser that means to do it does so promptly. This is long enough to let it, and short enough that a visitor who came back to a still pond sees the water return rather than wonders where it went.
const WATER_RESTORE_GRACE_MS = 1500

/**
 * How often the pond repeats its shoal report while nothing changes, in milliseconds.
 *
 * An undisturbed pond is otherwise silent for as long as the visitor lets it
 * be, and an embedder watching for signs of life reads that silence as an
 * outage. The roll call is the pond's liveness, spoken through the same
 * contract event a real change would use.
 */
const SHOAL_PULSE_MS = 10_000

/** How much wider a fingertip's hit-test is than a cursor's. */
const TOUCH_SLACK_SCALE = 2.6

/** How many times the pond re-opens a koi whose handshake timed out. */
const OPEN_RETRIES = 2

/** How long the pond waits before re-opening a timed-out koi, in milliseconds. */
const OPEN_RETRY_DELAY_MS = 4000

/** How far a press may wander before it stops being a tap and becomes a drag, in CSS pixels. */
const DRAG_SLOP_PX = 6

/** The wider slop a fingertip gets, in CSS pixels. */
const TOUCH_DRAG_SLOP_PX = 12

/** How close to the world's edge a carried koi may be set down, in nominal fish lengths. */
const DRAG_EDGE_INSET_FL = 0.3

/** How long a removed koi's polite close may take before its layer is torn down anyway, in milliseconds. */
const CLOSE_GRACE_MS = 4000

/** What the pond tells whatever mounted it. */
export interface PondHooks {
  /**
   * The connected shoal changed size.
   *
   * @param connected - How many koi are swimming.
   * @param expected - How many the pond expects.
   */
  onShoal(connected: number, expected: number): void
  /**
   * A disturbance sequence finished unwinding.
   *
   * @param fish - How many koi took part.
   */
  onSequenceComplete(fish: number): void
  /**
   * Something happened to a session worth a line in a diagnostics log.
   *
   * @param instance - Which koi, or `null` for a pond-wide note.
   * @param kind - What happened, as a short slug such as `error:unresponsive`.
   * @param detail - The particulars, already phrased for a human.
   */
  onDiagnostic?(instance: KoiInstanceId | null, kind: string, detail?: string): void
}

/** One living koi, as the host's shoal chrome reads the roster. */
export interface ShoalMember {
  /** The instance id everything session-shaped keys by. */
  id: KoiInstanceId
  /** The framework rendering it. */
  framework: KoiFramework
  /** Which of its framework's koi it is; 0 is the canonical fish. */
  ordinal: number
}

/** The living roster and the ceiling the device puts over it. */
export interface ShoalState {
  /** The device tier the ceiling derives from. */
  tier: DeviceTier
  /** The most koi this device seats. */
  cap: number
  /** Every living koi, in joining order. */
  roster: ShoalMember[]
}

/** The created scene: the contract-driven slice plus the host chrome's own handles. */
export interface PondSceneHandle extends PondScene {
  /**
   * Releases every held koi and aborts any carry in flight.
   *
   * Serves the host's own chrome — the Escape key — rather than the contract.
   *
   * @returns `true` when at least one koi was held.
   */
  releaseHeld(): boolean
  /**
   * Turns the decision overlay on or off.
   *
   * @param on - Whether to draw each koi's sensing cone and decided trajectory.
   */
  setInteractions(on: boolean): void
  /**
   * Adds another koi of a framework to the shoal.
   *
   * The newcomer takes its framework's lowest free ordinal, so a fish removed
   * and re-added comes back as the same animal. At the device-tier cap the add
   * is refused and diagnosed instead.
   *
   * @param framework - The framework to grow.
   * @returns The new instance's id, or `null` when the cap refused it.
   */
  addKoi(framework: KoiFramework): KoiInstanceId | null
  /**
   * Removes one koi from the shoal.
   *
   * The session closes politely first; the layer is torn down once the close
   * lands, or after a grace for a session past answering. The last koi is
   * refused — the pond is never empty.
   *
   * @param id - The instance to remove.
   * @returns `true` when the removal began.
   */
  removeKoi(id: KoiInstanceId): boolean
  /** The living roster and the device ceiling, for the host's shoal chrome. */
  shoalState(): ShoalState
}

/**
 * Raises the pond inside a root element and starts it.
 *
 * @param root - The `#pond` element from the page.
 * @param hooks - What the pond reports back to whatever mounted it.
 * @returns The scene, drivable by the pond's own contract.
 *
 * @example Raising the pond
 * ```typescript
 * const scene = createPond(pondRoot, { onShoal: reporter.shoal, onSequenceComplete: reporter.sequenceComplete })
 * ```
 */
export function createPond(root: HTMLElement, hooks: PondHooks): PondSceneHandle {
  const stage = createStage(root)
  // why: The GPU water is preferred and the 2D painter is the fallback — one page already carries eight fish contexts, and this ninth is the only one the host ever asks for.
  let surface = createWaterPainter(stage.surface, () => waterLost()) ?? createSurfacePainter(stage.surface)
  let waterHandle = 0

  /**
   * Hangs new water where the browser took the last.
   *
   * The painter asks for its context back on the way out, and a browser that
   * obliges leaves nothing to do here, which is why this waits before looking.
   * What it cannot do is wait forever: a context that is lost and not restored
   * can never be replaced on the canvas that held it, so the element goes and
   * the water is built again on a fresh one.
   */
  const reviveWater = (): void => {
    waterHandle = 0
    if (surface.lost?.() !== true || visibility.hidden) {
      return
    }
    hooks.onDiagnostic?.(null, 'water:reseated', 'the surface never got its context back')
    surface = createWaterPainter(reseatSurface(stage), () => waterLost()) ?? createSurfacePainter(stage.surface)
  }

  /** Gives the browser its chance to restore the context, then replaces the water if it did not. */
  const waterLost = (): void => {
    window.clearTimeout(waterHandle)
    waterHandle = window.setTimeout(reviveWater, WATER_RESTORE_GRACE_MS)
  }
  const relay = createRelay()
  const director = createDepthDirector()
  const sequence = createSequenceTracker()
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

  // why: The virtual pond derives from the screen, once — a gallery card, an expanded overlay, and a debug panel are windows onto this same water, and none of them may redefine it.
  let pond = describePond(window.screen.width, window.screen.height, root.clientWidth, root.clientHeight, motionQuery.matches)
  let field = createRippleField()
  // why: Every koi currently told the visitor is on it. The pointer lights exactly one; a keyboard visitor on a framework's row lights all of that framework's koi at once, which is how the shoal answers "which of these are the React ones".
  const hovered = new Set<KoiInstanceId>()
  // why: The one koi under the pointer, which is a narrower question than who is lit and the only one the cursor can answer.
  let picked: KoiInstanceId | null = null
  let lastRelayAt = 0
  let lastPulseAt = 0
  let scale: SceneScale = 'full'
  // why: The scene is decided exactly once — a pond never morphs between card and full in place; whatever presents it destroys and reopens instead.
  let sceneDecided = false
  // why: The card's koi rotates by local hour, chosen at boot and held — a card never swaps fish mid-mount, and the expanded trio anchors on the same fish so an expand reads as the same koi with company.
  const bootHour = new Date().getHours()
  let rootBounds = root.getBoundingClientRect()
  const pointer = { x: 0, y: 0, fresh: false }
  const inspected = new Set<KoiInstanceId>()
  const retries = new Map<KoiInstanceId, number>()
  // why: Which koi are actually answering right now — not merely which ones once opened. A frame the browser has given up on still exists, and everything the pond shows about a koi has to follow this one set or the scene starts claiming fish it has lost.
  const present = new Set<KoiInstanceId>()

  /** The press being tracked from a fish, from pointerdown until it resolves as a tap or a drag. */
  let drag: {
    id: KoiInstanceId
    pointerId: number
    startX: number
    startY: number
    offset: Vec2
    touch: boolean
    wasHeld: boolean
    dragging: boolean
    pending: Vec2 | null
    lastSent: Vec2 | null
  } | null = null

  const sessions = new Map<KoiInstanceId, KoiSession>()
  // why: A removed koi's layer lives on until its polite close lands, so its ordinal is not free yet — a twin re-added into that window would inherit a layer still holding the dying frame.
  const leaving = new Set<KoiInstanceId>()
  const device = readDeviceProfile()
  const chrome = createSelectionChrome(root)
  // why: The browser may kill any frame it likes on a phone; the resurrection is what turns that from a permanent hole in the shoal into a pause.
  const resurrection = createResurrection({
    isPresent: (id) => present.has(id),
    // why: The policy reads the pond's own answer about visibility rather than the document's, so a page that recovered without saying so does not leave a reopen waiting forever.
    isHidden: () => visibility.hidden,
    reopen: (id) => {
      sessions.get(id)?.shell.open()
    },
    note: (id, kind, detail) => hooks.onDiagnostic?.(id, `revive:${kind}`, detail),
  })
  const diagnostics = createInteractionsPainter(stage.interactions)
  let showInteractions = false

  /** Keeps the cursor honest about what a press would do right here. */
  const refreshCursor = (): void => {
    root.style.cursor =
      drag?.dragging === true ? 'grabbing' : picked !== null && inspected.has(picked) ? 'grab' : picked !== null ? 'pointer' : 'default'
  }

  /**
   * Tells koi whether a visitor is on them, and only the ones whose answer changed.
   *
   * @param next - Every koi to light, which may be none.
   */
  const setHover = (next: readonly KoiInstanceId[]): void => {
    const wanted = new Set(next)
    for (const id of hovered) {
      if (!wanted.has(id)) {
        sessions.get(id)?.shell.send('hover', { hovered: false })
        hovered.delete(id)
      }
    }
    for (const id of wanted) {
      if (!hovered.has(id)) {
        sessions.get(id)?.shell.send('hover', { hovered: true })
        hovered.add(id)
      }
    }
    panel.setHovered(hovered)
    refreshCursor()
  }

  /**
   * Records what the pointer found, which is at most one koi.
   *
   * @param next - The koi under the pointer, or `null` over open water.
   */
  const setPick = (next: KoiInstanceId | null): void => {
    picked = next
    setHover(next === null ? [] : [next])
  }

  /**
   * Drops a koi that has left the scene from everything hover-shaped.
   *
   * @param id - The koi that is no longer there.
   */
  const forgetHover = (id: KoiInstanceId): void => {
    if (picked === id) {
      picked = null
    }
    if (hovered.delete(id)) {
      panel.setHovered(hovered)
    }
  }

  /**
   * Sends one koi a contract action.
   *
   * @param id - Which koi.
   * @param type - The action type.
   * @param data - Its payload.
   */
  const sendTo = (id: KoiInstanceId, type: string, data: unknown): void => {
    sessions.get(id)?.shell.send(type, data)
  }

  /**
   * Tells one koi the level it now holds and restacks its layer to match.
   *
   * @param id - Which koi.
   */
  const notifyDepth = (id: KoiInstanceId): void => {
    sendTo(id, 'depth', { level: director.settledLevel(id) })
    setLayerDepth(stage, id, director.settledLevel(id))
  }

  /**
   * Holds a koi for inspection: pauses it and raises its ring.
   *
   * @param id - Which koi was pressed.
   */
  const hold = (id: KoiInstanceId): void => {
    if (inspected.has(id)) {
      return
    }
    // why: One inspection at a time — picking a new koi releases whichever one was held, whether the pick came from a tap or a click. release() only deletes the entry being visited, so walking the set while freeing is safe.
    for (const other of inspected) {
      release(other)
    }
    inspected.add(id)
    const framework = instanceFramework(id)
    chrome.hold(id, framework, fishHomeUrl(framework))
    sendTo(id, 'pause', { paused: true })
  }

  /**
   * Releases a held koi back to its own swimming.
   *
   * @param id - Which koi to free.
   */
  const release = (id: KoiInstanceId): void => {
    if (!inspected.has(id)) {
      return
    }
    inspected.delete(id)
    chrome.release(id)
    // why: In a card the fish's home posture is the resting hold, so letting go returns it there — unpausing outright would set it roaming a world barely bigger than its body.
    sendTo(id, 'pause', scale === 'card' ? { paused: true, resting: true } : { paused: false })
  }

  /**
   * Clamps a carried koi's nose into the world, a little off every edge.
   *
   * @param point - Where the pointer is carrying it.
   * @returns The point it may actually be set at.
   */
  const clampCarry = (point: Vec2): Vec2 => {
    const inset = pond.fishLength * DRAG_EDGE_INSET_FL
    return {
      x: Math.min(Math.max(point.x, inset), pond.width - inset),
      y: Math.min(Math.max(point.y, inset), pond.height - inset),
    }
  }

  /**
   * The living roster and the ceiling the device puts over it.
   *
   * @returns What the pond's own chrome and its console driver both read.
   */
  const shoalState = (): ShoalState => ({
    tier: device.tier,
    cap: device.cap,
    roster: [...sessions.values()].map((session) => ({ id: session.id, framework: session.framework, ordinal: session.ordinal })),
  })

  const panel = createShoalPanel(root, shoalState(), {
    fishUrl: fishHomeUrl,
    identify: (instances) => {
      setHover(instances)
    },
    add: (framework) => {
      addKoi(framework)
    },
    remove: (id) => {
      removeKoi(id)
    },
    interactions: (on) => {
      applyInteractions(on)
    },
  })

  /** Re-reads the whole shoal into the panel, which is what any churn owes it. */
  const refreshPanel = (): void => {
    panel.setShoal(shoalState())
    panel.setPresent(present)
  }

  /**
   * Records whether one koi is in the scene, everywhere the pond says so.
   *
   * A koi that has stopped answering is not a still koi: its frame holds
   * whatever the browser decided to put there, its last reported outline is
   * stale, and a visitor pointing at that water would be told a fish is
   * underneath it. Standing it down covers all four at once, and its next
   * handshake brings it back.
   *
   * @param id - Which koi.
   * @param here - Whether its session is answering.
   */
  const setPresent = (id: KoiInstanceId, here: boolean): void => {
    if (here === present.has(id)) {
      return
    }
    if (here) {
      present.add(id)
    } else {
      present.delete(id)
      relay.forget(id)
      release(id)
      if (drag?.id === id) {
        // why: A koi cannot be mid-carry once it has left the scene — the hand would be holding nothing and the cursor would keep saying otherwise.
        drag = null
      }
      forgetHover(id)
      refreshCursor()
    }
    setLayerPresent(stage, id, here)
    // why: A framework's row stands while any of that framework's koi is answering, and each koi's own control speaks only for itself; the panel reads both from this one set.
    panel.setPresent(present)
    hooks.onShoal(present.size, sessions.size)
  }

  /**
   * Re-measures the visible window, repaints the still bed, and tells every koi.
   *
   * Only the view moves — the virtual pond took its dimensions from the screen
   * when the scene opened, and a frame that grows or shrinks merely shows more
   * or less of the same water. The bed is deliberately not painted per frame —
   * it is stone and still water, and repainting it would be the most expensive
   * thing in a scene that already carries eight compositing layers.
   */
  const remeasure = (): void => {
    pond = { ...pond, view: pondWindow(pond, root.clientWidth, root.clientHeight), reducedMotion: motionQuery.matches }
    root.dataset['scene'] = scale
    rootBounds = root.getBoundingClientRect()
    // why: The pill threshold is the pond's own width rather than the viewport's, because a pond embedded in a narrow column on a wide screen has exactly the same shortage of room.
    panel.setFrameWidth(root.clientWidth)
    // why: Presented full over a host page the pond is a translucent layer — the page must stay perceptible beneath it; in a card it paints solid but lets its rounded edges thin toward the page, so the water reads as sitting in the card rather than pasted onto it.
    paintFloor(
      stage.floor,
      pond.view.width,
      pond.view.height,
      window.devicePixelRatio,
      scale === 'full' ? OVERLAY_FLOOR_ALPHA : 1,
      scale === 'card'
    )
    for (const session of sessions.values()) {
      session.shell.send('pond', pond)
    }
  }

  /**
   * The pond-space point under a pointer event.
   *
   * @param event - The pointer event.
   * @returns The point in pond space, view offset included.
   */
  const pondCoords = (event: PointerEvent): Vec2 => {
    // why: The rect is cached against resize — the pond root fills its frame, and measuring layout on every pointer move is the kind of per-event cost that adds up under eight compositing layers.
    return { x: event.clientX - rootBounds.left + pond.view.x, y: event.clientY - rootBounds.top + pond.view.y }
  }

  /**
   * Strikes the water and tells every koi about it.
   *
   * @param origin - Where the water broke, in pond space.
   */
  const strike = (origin: { x: number; y: number }): void => {
    const now = Date.now()
    if (acceptsRipple(field, 'pointer', now)) {
      field = addRipple(field, 'pointer', origin, POINTER_STRENGTH, now)
    }
    sequence.begin([...sessions.keys()], now)
    // why: The strike goes to every koi; how far each one is and whether it cares is its own judgement, not the host's.
    for (const session of sessions.values()) {
      session.shell.send('disturbance', { x: origin.x, y: origin.y, intensity: POINTER_STRENGTH })
    }
  }

  /**
   * Subscribes the pond to everything one koi's session says.
   *
   * @param session - The session to wire.
   */
  const wireSession = (session: KoiSession): void => {
    const { id, framework, ordinal, shell } = session

    shell.on('open', () => {
      shell.send('pond', pond)
      shell.send('identity', identityFor(framework, ordinal, director.settledLevel(id)))
      if (scale === 'card') {
        // why: A card wants a stationary-but-alive fish — the resting hold keeps the scull and drops every piece of held chrome, and it sidesteps the roaming pathologies a card-sized world invites.
        shell.send('pause', { paused: true, resting: true })
        // why: Opening stations are laid out to seat a whole shoal without crowding, so on water the size of a card they settle against its edges and hang the animal half outside the frame. One koi in a card belongs in the middle of it, and where a koi sits is the host's call.
        shell.send('place', pondPoint(pond, 0.5, 0.5))
      }
      setLayerDepth(stage, id, director.settledLevel(id))
      setPresent(id, true)
      resurrection.opened(id)
      // why: A handshake that landed makes past timeouts history — the retry budget guards one opening episode, not the whole page, or a koi revived after a slow boot would have nothing left.
      retries.delete(id)
      hooks.onDiagnostic?.(id, 'open')
      // why: The curtain holds until every koi has landed, so a visitor never watches the shoal arrive one frame at a time.
      if (present.size === sessions.size) {
        setCurtain(stage, true)
      }
    })

    // why: Status is the road back into the scene — only a real beat earns `healthy`, so this is what re-admits a koi the watchdog stood down once its frame proves alive again. The dead-frame verdict itself never lands here: it arrives on `error` below as `unresponsive`, and `gone` only follows an explicit close the close handler already covers.
    shell.on('status', (data: unknown) => {
      const status = <{ state?: string; missedBeats?: number }>data
      const state = status?.state
      hooks.onDiagnostic?.(
        id,
        `status:${state ?? 'unknown'}`,
        status?.missedBeats === undefined ? undefined : `missed ${status.missedBeats}`
      )
      if (state === 'gone') {
        setPresent(id, false)
      } else if (state === 'healthy') {
        setPresent(id, true)
      }
    })

    // ref: [guide:compose-independent-features/survive-close] start
    shell.on('close', () => {
      setPresent(id, false)
    })
    // ref: [guide:compose-independent-features/survive-close] end

    // why: The reopen policies listen separately: the guide-marked retry below answers a handshake that never landed, while the resurrection answers a frame that died mid-run and owes a live one the grace to speak again first. Subscribed ahead of the retry so the budget it reads is the one the retry is about to decide with.
    shell.on('error', (data: unknown) => {
      const error = <{ reason?: string; missedBeats?: number; elapsedMs?: number }>data
      const detail =
        error?.missedBeats !== undefined
          ? `missed ${error.missedBeats}`
          : error?.elapsedMs !== undefined
            ? `after ${Math.round(error.elapsedMs)}ms`
            : undefined
      hooks.onDiagnostic?.(id, `error:${error?.reason ?? 'unknown'}`, detail)
      if (error?.reason === 'unresponsive') {
        resurrection.frameDied(id)
      }
      // why: A reopen whose handshake times out after the retry budget is spent would otherwise strand the koi between the two policies — the retry declines and no watchdog exists to speak again. Handing the death to the resurrection lets its own budget decide when to stop insisting.
      if (error?.reason === 'open-timeout' && (retries.get(id) ?? 0) >= OPEN_RETRIES) {
        resurrection.frameDied(id)
      }
    })

    shell.on('close', () => {
      hooks.onDiagnostic?.(id, 'close')
    })

    // ref: [guide:compose-independent-features/retry-open] start
    shell.on('error', (data: unknown) => {
      // why: A koi that never answers must not hold the pond dark behind a curtain waiting for it.
      setCurtain(stage, true)
      // why: Whatever went wrong, the frame is no longer showing a koi — it waits for a handshake to earn its place back.
      setPresent(id, false)
      // why: A timed-out handshake leaves a destroyed mount and the SDK never retries — on a slow device the heavy apps race one deadline, and without this a loser is simply a fish that never existed. Only the timeout is retried; an unresponsive session may still be alive, and must not be torn down under its visitor.
      if ((<{ reason?: string }>data)?.reason === 'open-timeout' && (retries.get(id) ?? 0) < OPEN_RETRIES) {
        retries.set(id, (retries.get(id) ?? 0) + 1)
        window.setTimeout(() => {
          // why: The roster may have let this koi go while the retry waited; reopening a removed session would mount a frame into a layer the pond already tore down.
          if (sessions.get(id) === session) {
            shell.open()
          }
        }, OPEN_RETRY_DELAY_MS)
      }
    })
    // ref: [guide:compose-independent-features/retry-open] end

    shell.on('outline', (data: unknown) => {
      relay.record(id, <KoiOutline>data, Date.now())
    })

    shell.on('depth-request', (data: unknown) => {
      const level = (<{ level: number }>data).level
      if (director.request(id, level, Date.now())) {
        shell.send('depth', { level: director.settledLevel(id) })
        setLayerDepth(stage, id, director.settledLevel(id))
      }
    })

    shell.on('ripple-request', (data: unknown) => {
      const request = <{ x: number; y: number; strength: number }>data
      const now = Date.now()
      // why: Only the koi just under the surface may break it, and the host is what enforces that — a fish asking from the pond floor is simply refused.
      if (!mayRipple(director.settledLevel(id)) || !acceptsRipple(field, id, now)) {
        return
      }
      field = addRipple(field, id, { x: request.x, y: request.y }, request.strength, now)
    })

    shell.on('settled', () => {
      const fish = sequence.settle(id, Date.now())
      if (fish !== null) {
        hooks.onSequenceComplete(fish)
      }
    })
  }

  /**
   * Raises one koi instance: its layer, its shell, its wiring, and its place
   * in the depth spread.
   *
   * @param framework - The framework rendering it.
   * @param ordinal - Which of that framework's koi it is.
   * @returns The session, wired but not yet opened.
   */
  const openSession = (framework: KoiFramework, ordinal: number): KoiSession => {
    const session = openInstance(stage, framework, ordinal)
    sessions.set(session.id, session)
    // why: A joining koi re-deals the whole spread; everyone whose slot moved is told so their render and their layer keep agreeing about who is nearer the light.
    for (const moved of director.add(session.id, Date.now())) {
      notifyDepth(moved)
    }
    setLayerDepth(stage, session.id, director.settledLevel(session.id))
    wireSession(session)
    return session
  }

  /**
   * Opens the decided scene's roster: the hour-anchored koi alone in a card,
   * or the shoal it anchors in the full scene.
   *
   * A card is one koi whatever it measures, because a card is an invitation to
   * expand rather than a scene in itself. A full scene opens the shoal its own
   * frame can carry, bounded by what the device seats.
   *
   * @param decided - The scene the pond opens as.
   */
  const openProfile = (decided: SceneScale): void => {
    const count = decided === 'card' ? 1 : openingShoal(root.clientWidth, root.clientHeight, device.cap)
    for (let offset = 0; offset < count; offset += 1) {
      openSession(KOI_FRAMEWORKS[(bootHour + offset) % KOI_FRAMEWORKS.length] ?? 'vanilla', 0).shell.open()
    }
    refreshPanel()
  }

  /**
   * Adds another koi of a framework to the shoal.
   *
   * @param framework - The framework to grow.
   * @returns The new instance's id, or `null` when the cap refused it.
   */
  const addKoi = (framework: KoiFramework): KoiInstanceId | null => {
    if (sessions.size >= device.cap) {
      hooks.onDiagnostic?.(null, 'shoal:refused', `${device.tier}-tier device seats ${device.cap}`)
      return null
    }
    const session = openSession(framework, nextOrdinal([...sessions.keys(), ...leaving], framework))
    refreshPanel()
    hooks.onShoal(present.size, sessions.size)
    // why: A roster that changed under a visitor's hand is the first thing to know when reading back what a device did with the shoal it was carrying — the size it grew to is what every later reading has to be read against.
    hooks.onDiagnostic?.(session.id, 'added', `${sessions.size} of ${device.cap} koi`)
    session.shell.open()
    return session.id
  }

  /**
   * Removes one koi from the shoal, politely first.
   *
   * @param id - The instance to remove.
   * @returns `true` when the removal began.
   */
  const removeKoi = (id: KoiInstanceId): boolean => {
    const session = sessions.get(id)
    if (session === undefined) {
      return false
    }
    if (sessions.size <= 1) {
      hooks.onDiagnostic?.(null, 'shoal:refused', 'the pond is never empty')
      return false
    }
    sessions.delete(id)
    leaving.add(id)
    // why: The roster no longer wants this koi, so a revive still pending for it must die with it — the policy only governs instances the roster still wants.
    resurrection.forget(id)
    retries.delete(id)
    setPresent(id, false)
    for (const moved of director.remove(id, Date.now())) {
      notifyDepth(moved)
    }
    refreshPanel()
    hooks.onShoal(present.size, sessions.size)
    hooks.onDiagnostic?.(id, 'removed', `${sessions.size} of ${device.cap} koi`)
    let torndown = false
    const finalize = (): void => {
      if (torndown) {
        return
      }
      torndown = true
      unsubscribe()
      session.shell.destroy()
      removeLayer(stage, id)
      leaving.delete(id)
    }
    // why: The polite close is given first say — never a hard destroy under a live fish — and the grace covers a session past answering.
    const unsubscribe = session.shell.on('close', () => {
      finalize()
    })
    window.setTimeout(finalize, CLOSE_GRACE_MS)
    session.shell.close()
    return true
  }

  /**
   * Turns the decision overlay on or off, everywhere it is spoken for.
   *
   * @param on - Whether to draw each koi's sensing cone and decided trajectory.
   */
  const applyInteractions = (on: boolean): void => {
    showInteractions = on
    panel.setInteractions(on)
    if (!on) {
      diagnostics.clear()
    }
  }

  const observer = new ResizeObserver(() => {
    remeasure()
  })
  observer.observe(root)

  motionQuery.addEventListener('change', () => {
    remeasure()
  })

  // why: The host owns the only pointer stream in the pond — every koi frame is pointer-events:none, so this listener sees presses over the whole scene. Moves only record; the frame loop runs one hit-test per frame however fast the pointer reports.
  root.addEventListener('pointermove', (event: PointerEvent) => {
    if (drag !== null && event.pointerId === drag.pointerId) {
      if (!drag.dragging) {
        const wander = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
        if (wander > (drag.touch ? TOUCH_DRAG_SLOP_PX : DRAG_SLOP_PX)) {
          drag.dragging = true
          refreshCursor()
        }
      }
      if (drag.dragging) {
        const at = pondCoords(event)
        // why: The grab offset keeps the body under the hand exactly where it was picked up — anchoring the nose to the pointer would snap the fish on the first move.
        drag.pending = clampCarry({ x: at.x + drag.offset.x, y: at.y + drag.offset.y })
      }
      return
    }
    pointer.x = event.clientX
    pointer.y = event.clientY
    pointer.fresh = true
  })

  root.addEventListener('pointerleave', () => {
    if (drag !== null) {
      return
    }
    pointer.fresh = false
    setPick(null)
  })

  root.addEventListener('pointerdown', (event: PointerEvent) => {
    if (drag !== null) {
      return
    }
    const at = pondCoords(event)
    // why: A fingertip is blunter than a cursor and gets no hover pass first, so a tap hit-tests with widened slack — precision must never be the price of selecting a fish on a phone.
    const touch = event.pointerType === 'touch'
    const now = Date.now()
    const hit = relay.pick(at, pond, now, touch ? TOUCH_SLACK_SCALE : 1)
    // why: A press lands on a fish or on the water, never both — pressing a koi holds it, dragging carries it, releasing the press frees a koi that was already held, and only open water takes a strike.
    if (hit !== null) {
      const wasHeld = inspected.has(hit)
      hold(hit)
      const nose = relay.latest(hit, now)?.spine[0] ?? at
      drag = {
        id: hit,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offset: { x: nose.x - at.x, y: nose.y - at.y },
        touch,
        wasHeld,
        dragging: false,
        pending: null,
        lastSent: null,
      }
      root.setPointerCapture(event.pointerId)
      refreshCursor()
      return
    }
    strike(at)
  })

  // why: touch-action lets the browser take a pan mid-press and cancel the pointer under the finger; suppressing scroll only for presses that began on a fish keeps every other gesture on the page untouched.
  root.addEventListener(
    'touchmove',
    (event: TouchEvent) => {
      if (drag !== null) {
        event.preventDefault()
      }
    },
    { passive: false }
  )

  /**
   * Resolves the tracked press: a drag drops and frees the koi, a plain tap
   * frees it only when it was already held before this press.
   *
   * @param event - The pointer event ending the press.
   */
  const endPress = (event: PointerEvent): void => {
    if (drag === null || event.pointerId !== drag.pointerId) {
      return
    }
    const press = drag
    drag = null
    if (press.dragging) {
      if (press.pending !== null) {
        sendTo(press.id, 'place', press.pending)
      }
      // why: Dropping is releasing — the koi resumes its own swimming from wherever it was set down, with no second tap owed.
      release(press.id)
    } else if (press.wasHeld) {
      release(press.id)
    }
    refreshCursor()
  }

  root.addEventListener('pointerup', endPress)
  root.addEventListener('pointercancel', endPress)

  // why: The paint frame is one long-lived object the loop rewrites — a fresh literal per frame is sixty needless allocations a second on the hottest path the host owns.
  const surfaceFrame = {
    width: 0,
    height: 0,
    view: { x: 0, y: 0 },
    pixelRatio: 1,
    fishLength: 0,
    elapsedMs: 0,
    reducedMotion: false,
    fade: 0,
    field,
  }

  // why: Reused for the same reason as the surface frame; the shoal array is refilled in place each drawn frame.
  const interactionsFrame = {
    width: 0,
    height: 0,
    view: { x: 0, y: 0 },
    pixelRatio: 1,
    dt: 0,
    shoal: <KoiSighting[]>[],
  }

  const loop = createFrameLoop(({ dt, elapsedMs }) => {
    const now = Date.now()
    field = advanceRipples(field, dt)

    // why: The drag streams one placement per painted frame however fast the pointer reports, and the hover pick stands down — a hand carrying one fish must not flash every card it passes over.
    if (drag !== null && drag.pending !== null) {
      sendTo(drag.id, 'place', drag.pending)
      drag.lastSent = drag.pending
      drag.pending = null
    } else if (drag === null && pointer.fresh) {
      pointer.fresh = false
      setPick(relay.pick({ x: pointer.x - rootBounds.left + pond.view.x, y: pointer.y - rootBounds.top + pond.view.y }, pond, now))
    }

    // why: The chrome follows each held koi's reported card; while a fish is being carried its card chrome hides so nothing sits clickable under the moving hand.
    for (const id of inspected) {
      const carried = drag !== null && drag.dragging && drag.id === id
      chrome.trackCard(id, carried ? null : (relay.latest(id, now)?.card ?? null), pond)
    }

    for (const id of director.advance(now)) {
      setLayerDepth(stage, id, director.settledLevel(id))
    }

    const abandoned = sequence.expire(now)
    if (abandoned !== null) {
      hooks.onSequenceComplete(abandoned)
    }

    // ref: [guide:compose-independent-features/relay-fanout] start
    if (elapsedMs - lastRelayAt >= RELAY_INTERVAL_MS) {
      lastRelayAt = elapsedMs
      for (const session of sessions.values()) {
        session.shell.send('neighbors', relay.neighborsFor(session.id, pond, now))
      }
    }
    // ref: [guide:compose-independent-features/relay-fanout] end

    // why: A calm pond would otherwise say nothing for as long as the visitor lets it be calm, and an embedder watching for life reads thirty silent seconds as an outage — the roll call keeps the liveness flowing through the contract itself.
    if (elapsedMs - lastPulseAt >= SHOAL_PULSE_MS) {
      lastPulseAt = elapsedMs
      hooks.onShoal(present.size, sessions.size)
    }

    surfaceFrame.width = pond.view.width
    surfaceFrame.height = pond.view.height
    surfaceFrame.view.x = pond.view.x
    surfaceFrame.view.y = pond.view.y
    surfaceFrame.pixelRatio = window.devicePixelRatio
    surfaceFrame.fishLength = pond.fishLength
    surfaceFrame.elapsedMs = elapsedMs
    surfaceFrame.reducedMotion = pond.reducedMotion
    surfaceFrame.fade = scale === 'card' ? 1 : 0
    surfaceFrame.field = field
    surface.paint(surfaceFrame)

    if (showInteractions) {
      interactionsFrame.width = pond.view.width
      interactionsFrame.height = pond.view.height
      interactionsFrame.view.x = pond.view.x
      interactionsFrame.view.y = pond.view.y
      interactionsFrame.pixelRatio = window.devicePixelRatio
      interactionsFrame.dt = dt
      interactionsFrame.shoal.length = 0
      for (const session of sessions.values()) {
        const latest = relay.latest(session.id, now)
        if (latest !== null) {
          // why: The overlay carries a pearl chain per koi across frames, so a report reaches it under the host's own name for the fish that made it.
          interactionsFrame.shoal.push({ id: session.id, outline: latest })
        }
      }
      diagnostics.paint(interactionsFrame)
    }
  })

  // why: Eight iframes on their own compositing layers is exactly where a loop running against a hidden tab costs a visitor real battery.
  const visibility = createVisibilityWatch({
    apply: (paused, source) => {
      hooks.onDiagnostic?.(null, paused ? 'page-hidden' : 'page-visible', `by ${source}`)
      if (paused) {
        loop.stop()
      } else {
        // why: A context lost while the pond was hidden is left alone until this moment, because building a GPU context for a page nobody is looking at is exactly the cost the sleep was for.
        if (surface.lost?.() === true) {
          waterLost()
        }
        loop.start()
        resurrection.pageVisible()
      }
      for (const session of sessions.values()) {
        session.shell.send('sleep', { paused })
      }
    },
  })

  // why: A koi whose app is unreachable emits neither open nor error until its handshake deadline; the pond should not be a dark rectangle while that plays out.
  window.setTimeout(() => {
    setCurtain(stage, true)
  }, CURTAIN_DEADLINE_MS)

  remeasure()
  loop.start()

  return {
    setScale(next) {
      if (!sceneDecided) {
        sceneDecided = true
        scale = next
        if (next === 'card') {
          // why: A card is a small world of its own, derived from the frame that shows it — not the device's screen seen through a keyhole, which left the card empty water most of the time.
          pond = describePondForFrame(root.clientWidth, root.clientHeight, motionQuery.matches)
        }
        openProfile(next)
        remeasure()
        return
      }
      if (next !== scale) {
        // why: An instance never morphs — a contradicting scene this late is a host bug worth a log line, never a rebuild of the world under a swimming shoal.
        hooks.onDiagnostic?.(null, 'scene:ignored', `decided ${scale}, told ${next}`)
      }
    },
    disturbAt(fx, fy) {
      strike(pondPoint(pond, fx, fy))
    },
    releaseHeld() {
      if (inspected.size === 0) {
        return false
      }
      // why: Escape lets go of a carry too — the koi is released from wherever the drag last streamed it, exactly as a drop would have left it.
      drag = null
      // note: release() only deletes the entry being visited, which set iteration allows mid-walk.
      for (const id of inspected) {
        release(id)
      }
      refreshCursor()
      return true
    },
    setInteractions(on) {
      applyInteractions(on)
    },
    addKoi(framework) {
      return addKoi(framework)
    },
    removeKoi(id) {
      return removeKoi(id)
    },
    shoalState() {
      return shoalState()
    },
  }
}
