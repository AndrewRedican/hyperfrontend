/**
 * The pond scene: everything the host owns, assembled.
 *
 * The bed, the surface water, the pointer, the depth order, the curtain, the
 * roster, and the seven channels. Every koi is a separate application in a
 * separate frame; this module's whole job is to make those read as one
 * continuous scene, and to keep the seams — the relay, the depth grants, the
 * ripple gate — on the host's side of the boundary where they belong.
 */
import type { KoiFramework, KoiOutline, Vec2 } from '@hyperfrontend/demo-koi-lib'
import type { PondScene, SceneScale } from '../feature/wire-contract'
import { KOI_FRAMEWORKS, describePond, mayRipple, pondPoint, pondWindow } from '@hyperfrontend/demo-koi-lib'
import { createDepthDirector } from './depth-director'
import { createFrameLoop } from './raf-loop'
import { createRelay } from './relay'
import { createSelectionChrome } from './selection'
import { createRoster } from './roster'
import { createSequenceTracker } from './sequence'
import { createStage, setCurtain, setLayerDepth } from './stage'
import { createSurfacePainter } from './surface-canvas'
import { createWaterPainter } from './water-gl'
import { acceptsRipple, addRipple, advanceRipples, createRippleField } from './ripples'
import { fishHomeUrl, identityFor, openShoal } from './koi-sessions'
import { paintFloor } from './floor'

/** How often the host relays each koi its neighbours, in milliseconds. */
const RELAY_INTERVAL_MS = 120

/** How hard a pointer press strikes the water. */
const POINTER_STRENGTH = 1

/** Longest the curtain waits for the last koi before revealing the pond anyway. */
const CURTAIN_DEADLINE_MS = 5000

/** How opaque the pond's own paint is when it runs as a layer over a host page. */
const OVERLAY_FLOOR_ALPHA = 0.7

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
export function createPond(root: HTMLElement, hooks: PondHooks): PondScene {
  const stage = createStage(root)
  // why: The GPU water is preferred and the 2D painter is the fallback — one page already carries seven fish contexts, and this eighth is the only one the host ever asks for.
  const surface = createWaterPainter(stage.surface) ?? createSurfacePainter(stage.surface)
  const relay = createRelay()
  const director = createDepthDirector(Date.now())
  const sequence = createSequenceTracker()
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

  // why: The virtual pond derives from the screen, once — a gallery card, an expanded overlay, and a debug panel are windows onto this same water, and none of them may redefine it.
  let pond = describePond(window.screen.width, window.screen.height, root.clientWidth, root.clientHeight, motionQuery.matches)
  let field = createRippleField()
  let hovered: KoiFramework | null = null
  let lastRelayAt = 0
  let lastPulseAt = 0
  let opened = 0
  let scale: SceneScale = 'full'
  let rootBounds = root.getBoundingClientRect()
  const pointer = { x: 0, y: 0, fresh: false }
  const inspected = new Set<KoiFramework>()
  const retries = new Map<KoiFramework, number>()

  /** The press being tracked from a fish, from pointerdown until it resolves as a tap or a drag. */
  let drag: {
    framework: KoiFramework
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

  const sessions = openShoal(stage.layers)
  const chrome = createSelectionChrome(root)

  /** Keeps the cursor honest about what a press would do right here. */
  const refreshCursor = (): void => {
    root.style.cursor =
      drag?.dragging === true ? 'grabbing' : hovered !== null && inspected.has(hovered) ? 'grab' : hovered !== null ? 'pointer' : 'default'
  }

  /**
   * Tells one koi whether the pointer is on it, and only when that changed.
   *
   * @param next - The koi under the pointer, or `null` over open water.
   */
  const setHover = (next: KoiFramework | null): void => {
    if (next === hovered) {
      return
    }
    for (const session of sessions) {
      if (session.framework === hovered) {
        session.shell.send('hover', { hovered: false })
      }
      if (session.framework === next) {
        session.shell.send('hover', { hovered: true })
      }
    }
    hovered = next
    roster.setHovered(next)
    refreshCursor()
  }

  /**
   * Sends one koi a contract action.
   *
   * @param framework - Which koi.
   * @param type - The action type.
   * @param data - Its payload.
   */
  const sendTo = (framework: KoiFramework, type: string, data: unknown): void => {
    for (const session of sessions) {
      if (session.framework === framework) {
        session.shell.send(type, data)
      }
    }
  }

  /**
   * Holds a koi for inspection: pauses it and raises its ring.
   *
   * @param framework - Which koi was pressed.
   */
  const hold = (framework: KoiFramework): void => {
    if (inspected.has(framework)) {
      return
    }
    inspected.add(framework)
    chrome.hold(framework, fishHomeUrl(framework))
    sendTo(framework, 'pause', { paused: true })
  }

  /**
   * Releases a held koi back to its own swimming.
   *
   * @param framework - Which koi to free.
   */
  const release = (framework: KoiFramework): void => {
    if (!inspected.has(framework)) {
      return
    }
    inspected.delete(framework)
    chrome.release(framework)
    sendTo(framework, 'pause', { paused: false })
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

  const roster = createRoster(root, fishHomeUrl, setHover)

  /**
   * Re-measures the visible window, repaints the still bed, and tells every koi.
   *
   * Only the view moves — the virtual pond took its dimensions from the screen
   * when the scene opened, and a frame that grows or shrinks merely shows more
   * or less of the same water. The bed is deliberately not painted per frame —
   * it is stone and still water, and repainting it would be the most expensive
   * thing in a scene that already carries seven compositing layers.
   */
  const remeasure = (): void => {
    pond = { ...pond, view: pondWindow(pond, root.clientWidth, root.clientHeight), reducedMotion: motionQuery.matches }
    root.dataset['scene'] = scale
    rootBounds = root.getBoundingClientRect()
    // why: Presented full over a host page the pond is a translucent layer — the page must stay perceptible beneath it; in a card it paints solid but lets its rounded edges thin toward the page, so the water reads as sitting in the card rather than pasted onto it.
    paintFloor(
      stage.floor,
      pond.view.width,
      pond.view.height,
      window.devicePixelRatio,
      scale === 'full' ? OVERLAY_FLOOR_ALPHA : 1,
      scale === 'card'
    )
    for (const session of sessions) {
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
    // why: The rect is cached against resize — the pond root fills its frame, and measuring layout on every pointer move is the kind of per-event cost that adds up under seven compositing layers.
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
    sequence.begin(
      sessions.map((session) => session.framework),
      now
    )
    // why: The strike goes to every koi; how far each one is and whether it cares is its own judgement, not the host's.
    for (const session of sessions) {
      session.shell.send('disturbance', { x: origin.x, y: origin.y, intensity: POINTER_STRENGTH })
    }
  }

  for (const session of sessions) {
    const { framework, shell } = session

    shell.on('open', () => {
      opened += 1
      shell.send('pond', pond)
      shell.send('identity', identityFor(framework, director.settledLevel(framework)))
      setLayerDepth(stage, framework, director.settledLevel(framework))
      roster.setConnected(framework, true)
      hooks.onShoal(opened, sessions.length)
      // why: The curtain holds until every koi has landed, so a visitor never watches the shoal arrive one frame at a time.
      if (opened === sessions.length) {
        setCurtain(stage, true)
      }
    })

    shell.on('close', () => {
      opened = Math.max(0, opened - 1)
      relay.forget(framework)
      inspected.delete(framework)
      chrome.release(framework)
      if (drag?.framework === framework) {
        drag = null
        refreshCursor()
      }
      roster.setConnected(framework, false)
      hooks.onShoal(opened, sessions.length)
      if (hovered === framework) {
        setHover(null)
      }
    })

    shell.on('error', (data: unknown) => {
      // why: A koi that never answers must not hold the pond dark behind a curtain waiting for it.
      setCurtain(stage, true)
      // why: A timed-out handshake leaves a destroyed mount and the SDK never retries — on a slow device the seven heavy apps race one deadline, and without this a loser is simply a fish that never existed. Only the timeout is retried; an unresponsive session is still alive and must not be torn down under its visitor.
      if ((<{ reason?: string }>data)?.reason === 'open-timeout' && (retries.get(framework) ?? 0) < OPEN_RETRIES) {
        retries.set(framework, (retries.get(framework) ?? 0) + 1)
        window.setTimeout(() => {
          shell.open()
        }, OPEN_RETRY_DELAY_MS)
      }
    })

    shell.on('outline', (data: unknown) => {
      relay.record(<KoiOutline>data, Date.now())
    })

    shell.on('depth-request', (data: unknown) => {
      const level = (<{ level: number }>data).level
      if (director.request(framework, level, Date.now())) {
        shell.send('depth', { level: director.settledLevel(framework) })
        setLayerDepth(stage, framework, director.settledLevel(framework))
      }
    })

    shell.on('ripple-request', (data: unknown) => {
      const request = <{ x: number; y: number; strength: number }>data
      const now = Date.now()
      // why: Only the koi just under the surface may break it, and the host is what enforces that — a fish asking from the pond floor is simply refused.
      if (!mayRipple(director.settledLevel(framework)) || !acceptsRipple(field, framework, now)) {
        return
      }
      field = addRipple(field, framework, { x: request.x, y: request.y }, request.strength, now)
    })

    shell.on('settled', () => {
      const fish = sequence.settle(framework, Date.now())
      if (fish !== null) {
        hooks.onSequenceComplete(fish)
      }
    })

    shell.open()
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
    setHover(null)
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
        framework: hit,
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
        sendTo(press.framework, 'place', press.pending)
      }
      // why: Dropping is releasing — the koi resumes its own swimming from wherever it was set down, with no second tap owed.
      release(press.framework)
    } else if (press.wasHeld) {
      release(press.framework)
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

  const loop = createFrameLoop(({ dt, elapsedMs }) => {
    const now = Date.now()
    field = advanceRipples(field, dt)

    // why: The drag streams one placement per painted frame however fast the pointer reports, and the hover pick stands down — a hand carrying one fish must not flash every card it passes over.
    if (drag !== null && drag.pending !== null) {
      sendTo(drag.framework, 'place', drag.pending)
      drag.lastSent = drag.pending
      drag.pending = null
    } else if (drag === null && pointer.fresh) {
      pointer.fresh = false
      setHover(relay.pick({ x: pointer.x - rootBounds.left + pond.view.x, y: pointer.y - rootBounds.top + pond.view.y }, pond, now))
    }

    // why: The chrome follows each held koi's reported card; while a fish is being carried its card chrome hides so nothing sits clickable under the moving hand.
    for (const framework of inspected) {
      const carried = drag !== null && drag.dragging && drag.framework === framework
      chrome.trackCard(framework, carried ? null : (relay.latest(framework, now)?.card ?? null), pond)
    }

    for (const framework of director.advance(now)) {
      setLayerDepth(stage, framework, director.settledLevel(framework))
    }

    const abandoned = sequence.expire(now)
    if (abandoned !== null) {
      hooks.onSequenceComplete(abandoned)
    }

    if (elapsedMs - lastRelayAt >= RELAY_INTERVAL_MS) {
      lastRelayAt = elapsedMs
      for (const session of sessions) {
        session.shell.send('neighbors', relay.neighborsFor(session.framework, pond, now))
      }
    }

    // why: A calm pond would otherwise say nothing for as long as the visitor lets it be calm, and an embedder watching for life reads thirty silent seconds as an outage — the roll call keeps the liveness flowing through the contract itself.
    if (elapsedMs - lastPulseAt >= SHOAL_PULSE_MS) {
      lastPulseAt = elapsedMs
      hooks.onShoal(opened, sessions.length)
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
  })

  // why: Seven iframes on their own compositing layers is exactly where a loop running against a hidden tab costs a visitor real battery.
  document.addEventListener('visibilitychange', () => {
    const paused = document.hidden
    if (paused) {
      loop.stop()
    } else {
      loop.start()
    }
    for (const session of sessions) {
      session.shell.send('sleep', { paused })
    }
  })

  // why: A koi whose app is unreachable emits neither open nor error until its handshake deadline; the pond should not be a dark rectangle while that plays out.
  window.setTimeout(() => {
    setCurtain(stage, true)
  }, CURTAIN_DEADLINE_MS)

  for (const framework of KOI_FRAMEWORKS) {
    roster.setConnected(framework, false)
  }

  remeasure()
  loop.start()

  return {
    setScale(next) {
      if (next === scale) {
        return
      }
      scale = next
      remeasure()
    },
    disturbAt(fx, fy) {
      strike(pondPoint(pond, fx, fy))
    },
  }
}
