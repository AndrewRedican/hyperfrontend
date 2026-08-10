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
import { createControls } from './controls'
import { createDepthDirector } from './depth-director'
import { createFrameLoop } from './raf-loop'
import { createRelay } from './relay'
import { createRoster } from './roster'
import { createSequenceTracker } from './sequence'
import { createStage, setCurtain, setLayerDepth } from './stage'
import { createSurfacePainter } from './surface-canvas'
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
  const surface = createSurfacePainter(stage.surface)
  const relay = createRelay()
  const director = createDepthDirector(Date.now())
  const sequence = createSequenceTracker()
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

  // why: The virtual pond derives from the screen, once — a gallery card, an expanded overlay, and a debug panel are windows onto this same water, and none of them may redefine it.
  let pond = describePond(window.screen.width, window.screen.height, root.clientWidth, root.clientHeight, motionQuery.matches)
  let field = createRippleField()
  let hovered: KoiFramework | null = null
  let lastRelayAt = 0
  let opened = 0
  let scale: SceneScale = 'full'
  const inspected = new Set<KoiFramework>()

  const sessions = openShoal(stage.layers)

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
    root.style.cursor = next === null ? 'default' : 'pointer'
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
    // why: Presented full over a host page the pond is a translucent layer — the page must stay perceptible beneath it; in a card it paints solid so the small window stays legible.
    paintFloor(stage.floor, pond.view.width, pond.view.height, window.devicePixelRatio, scale === 'full' ? OVERLAY_FLOOR_ALPHA : 1)
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
    const bounds = root.getBoundingClientRect()
    return { x: event.clientX - bounds.left + pond.view.x, y: event.clientY - bounds.top + pond.view.y }
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
      roster.setConnected(framework, false)
      hooks.onShoal(opened, sessions.length)
      if (hovered === framework) {
        setHover(null)
      }
    })

    shell.on('error', () => {
      // why: A koi that never answers must not hold the pond dark behind a curtain waiting for it.
      setCurtain(stage, true)
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

  // why: The host owns the only pointer stream in the pond — every koi frame is pointer-events:none, so this listener sees presses over the whole scene.
  root.addEventListener('pointermove', (event: PointerEvent) => {
    setHover(relay.pick(pondCoords(event), pond, Date.now()))
  })

  root.addEventListener('pointerleave', () => {
    setHover(null)
  })

  root.addEventListener('pointerdown', (event: PointerEvent) => {
    const at = pondCoords(event)
    const hit = relay.pick(at, pond, Date.now())
    // why: A press lands on a fish or on the water, never both — clicking a koi holds it for inspection, clicking it again frees it, and only open water takes a strike.
    if (hit !== null) {
      const holding = !inspected.has(hit)
      if (holding) {
        inspected.add(hit)
      } else {
        inspected.delete(hit)
      }
      for (const session of sessions) {
        if (session.framework === hit) {
          session.shell.send('pause', { paused: holding })
        }
      }
      return
    }
    strike(at)
  })

  const loop = createFrameLoop(({ dt, elapsedMs }) => {
    const now = Date.now()
    field = advanceRipples(field, dt)

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

    surface.paint({
      width: pond.view.width,
      height: pond.view.height,
      view: { x: pond.view.x, y: pond.view.y },
      pixelRatio: window.devicePixelRatio,
      fishLength: pond.fishLength,
      elapsedMs,
      reducedMotion: pond.reducedMotion,
      field,
    })
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

  createControls(root, {
    onTune(tune) {
      for (const session of sessions) {
        session.shell.send('tune', tune)
      }
    },
  })

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
