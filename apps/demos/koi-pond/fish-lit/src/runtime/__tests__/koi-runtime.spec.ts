import type { KoiTune } from '@hyperfrontend/demo-koi-lib'
import type { ReactiveControllerHost } from 'lit'
import type { KoiState } from '../../koi/koi-motion'
import type { KoiRenderer } from '../../koi/koi-render'
import type { KoiRendererFactory } from '../koi-runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { KoiSwimController } from '../koi-runtime'

/** A renderer stand-in recording what the loop asked it to draw. */
interface FakeRenderer extends KoiRenderer {
  draws: number
  ponds: number
  hovers: boolean[]
  tunes: KoiTune[]
  last: KoiState | null
}

/**
 * Builds the renderer stand-in the controller drives.
 *
 * @returns The fake renderer.
 */
function fakeRenderer(): FakeRenderer {
  const fake: FakeRenderer = {
    get koi(): never {
      throw new Error('the runtime never reads the koi handle')
    },
    draws: 0,
    ponds: 0,
    hovers: [],
    tunes: [],
    last: null,
    draw(state) {
      fake.draws += 1
      fake.last = state
    },
    setPond() {
      fake.ponds += 1
    },
    setHovered(hovered) {
      fake.hovers.push(hovered)
    },
    placeCard() {},
    applyTune(tune) {
      fake.tunes.push(tune)
    },
    dispose() {},
  }
  return fake
}

/** A hand-driven `requestAnimationFrame`, so specs choose every frame's timestamp. */
function createRaf() {
  let pending: FrameRequestCallback | null = null
  const request = (callback: FrameRequestCallback): number => {
    pending = callback
    return 1
  }
  /**
   * Runs the frame the loop is waiting on at a chosen timestamp.
   *
   * @param timestamp - The millisecond stamp to hand the frame.
   */
  const tick = (timestamp: number): void => {
    const callback = pending
    pending = null
    callback?.(timestamp)
  }
  return { request, tick }
}

/** A host stand-in: the controller registers with it and never needs a render from it. */
function fakeHost(): ReactiveControllerHost {
  return {
    addController() {},
    removeController() {},
    requestUpdate() {},
    updateComplete: Promise.resolve(true),
  }
}

describe('KoiSwimController', () => {
  let renderer: FakeRenderer
  let raf: ReturnType<typeof createRaf>
  const build: KoiRendererFactory = () => renderer

  beforeEach(() => {
    renderer = fakeRenderer()
    raf = createRaf()
    vi.stubGlobal('requestAnimationFrame', raf.request)
    window.requestAnimationFrame = raf.request
    // why: jsdom ships no matchMedia, and the standalone fallback reads it once at construction to honour reduced motion.
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /**
   * Builds a controller and walks it through its element's lifecycle by hand.
   *
   * @returns The controller, connected and attached the way its element would.
   */
  function createSwim(): KoiSwimController {
    const swim = new KoiSwimController(fakeHost(), build)
    // why: Lit connects the element before its first render, so the loop starts first and the stage arrives one update later — the spec walks the same order.
    swim.hostConnected()
    swim.attach(document.createElement('canvas'), document.createElement('div'))
    return swim
  }

  /**
   * Collects every action a controller emits.
   *
   * @param swim - The controller to listen to.
   * @returns The emitted actions in order.
   */
  function emissions(swim: KoiSwimController): { type: string; data: unknown }[] {
    const out: { type: string; data: unknown }[] = []
    swim.connect((type, data) => out.push({ type, data }))
    return out
  }

  it('draws a frame each tick', () => {
    createSwim()
    raf.tick(1000)
    raf.tick(1016)
    expect(renderer.draws).toBe(2)
  })

  it('reports its outline no more than once every hundred milliseconds', () => {
    const swim = createSwim()
    const sent = emissions(swim)
    const outlines = (): number => sent.filter((action) => action.type === 'outline').length
    raf.tick(1000)
    // why: The first frame reports at once, then the gate holds the next report back a hundred milliseconds.
    expect(outlines()).toBe(1)
    raf.tick(1050)
    expect(outlines()).toBe(1)
    raf.tick(1101)
    expect(outlines()).toBe(2)
    raf.tick(1150)
    expect(outlines()).toBe(2)
    raf.tick(1202)
    expect(outlines()).toBe(3)
  })

  it('reports a finite spine the host can use', () => {
    const swim = createSwim()
    const sent = emissions(swim)
    raf.tick(1000)
    raf.tick(1101)
    const outline = sent.find((action) => action.type === 'outline')?.data as { spine: { x: number; y: number }[] }
    expect(outline.spine.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true)
  })

  /**
   * Reads the nose of the last outline a controller reported.
   *
   * @param sent - The controller's emissions.
   * @returns The nose in pond space.
   */
  function lastNose(sent: { type: string; data: unknown }[]): { x: number; y: number } {
    const outline = sent.filter((action) => action.type === 'outline').at(-1)?.data as { spine: { x: number; y: number }[] }
    const nose = outline.spine[0]
    if (nose === undefined) {
      throw new Error('the outline carried no spine')
    }
    return nose
  }

  it('asks to break the surface only when it is near it and moving hard', () => {
    const deep = createSwim()
    const deepSent = emissions(deep)
    raf.tick(1000)
    const deepNose = lastNose(deepSent)
    // why: A strike right on the koi is unmistakably inside its awareness, so this isolates the surface gate from the reaction geometry.
    deep.startle({ x: deepNose.x - 5, y: deepNose.y - 5, intensity: 1 })
    for (let ts = 1016; ts <= 4000; ts += 16) {
      raf.tick(ts)
    }
    // why: A koi on the pond floor may never break the surface however hard it bolts.
    expect(deepSent.some((action) => action.type === 'ripple-request')).toBe(false)

    const surfacing = createSwim()
    const surfaceSent = emissions(surfacing)
    surfacing.setDepth(6)
    // why: Let the depth roll settle to the surface before the strike, so the koi is unambiguously at the level that may ripple when it bolts.
    for (let ts = 1000; ts <= 2600; ts += 16) {
      raf.tick(ts)
    }
    const surfaceNose = lastNose(surfaceSent)
    surfacing.startle({ x: surfaceNose.x - 5, y: surfaceNose.y - 5, intensity: 1 })
    for (let ts = 2616; ts <= 5000; ts += 16) {
      raf.tick(ts)
    }
    expect(surfaceSent.some((action) => action.type === 'ripple-request')).toBe(true)
  })

  it('tells the host it has settled once its escape unwinds', () => {
    const swim = createSwim()
    const sent = emissions(swim)
    raf.tick(1000)
    const nose = lastNose(sent)
    swim.startle({ x: nose.x - 5, y: nose.y - 5, intensity: 1 })
    for (let ts = 1016; ts <= 14000; ts += 16) {
      raf.tick(ts)
    }
    expect(sent.filter((action) => action.type === 'settled')).toHaveLength(1)
    expect(sent.at(-1)?.type).not.toBe('settled')
  })

  it('holds still while paused and resumes after', () => {
    const swim = createSwim()
    const sent = emissions(swim)
    swim.setPaused(true)
    raf.tick(1000)
    raf.tick(2000)
    expect(renderer.draws).toBe(0)
    expect(sent).toHaveLength(0)
    swim.setPaused(false)
    raf.tick(3000)
    expect(renderer.draws).toBe(1)
  })

  it('holds its position for inspection while still sculling and reporting', () => {
    const swim = createSwim()
    const sent = emissions(swim)
    raf.tick(1000)
    raf.tick(1101)
    const before = lastNose(sent)
    swim.setInspected(true)
    for (let ts = 1116; ts <= 3200; ts += 16) {
      raf.tick(ts)
    }
    const held = lastNose(sent)
    // why: An inspected koi is stopped to be looked at — it must stay put, keep drawing its idle scull, and keep reporting so hover identity still works.
    expect(Math.hypot(held.x - before.x, held.y - before.y)).toBeLessThan(1)
    expect(renderer.draws).toBeGreaterThan(100)
    const outline = sent.filter((action) => action.type === 'outline').at(-1)?.data as { speed: number }
    expect(outline.speed).toBe(0)
    swim.setInspected(false)
    for (let ts = 3216; ts <= 4300; ts += 16) {
      raf.tick(ts)
    }
    const resumed = lastNose(sent)
    expect(Math.hypot(resumed.x - held.x, resumed.y - held.y)).toBeGreaterThan(10)
  })

  it('routes the playground tune to both the brain and the renderer', () => {
    const swim = createSwim()
    swim.applyTune({ speedScale: 0.5, widthScale: 1.2 })
    expect(renderer.tunes).toEqual([{ speedScale: 0.5, widthScale: 1.2 }])
  })

  it('clamps a long stall so the koi cannot leap across the pond', () => {
    const steady = createSwim()
    const steadySent = emissions(steady)
    raf.tick(1000)
    for (let ts = 1016; ts <= 1500; ts += 16) {
      raf.tick(ts)
    }
    const stalled = createSwim()
    const stalledSent = emissions(stalled)
    raf.tick(1000)
    // why: A tab that was backgrounded for ten seconds must advance one clamped frame, not ten seconds of travel in a single leap.
    raf.tick(11000)
    for (let ts = 11016; ts <= 11500; ts += 16) {
      raf.tick(ts)
    }
    const steadyNose = lastNose(steadySent)
    const stalledNose = lastNose(stalledSent)
    const drift = Math.hypot(stalledNose.x - steadyNose.x, stalledNose.y - steadyNose.y)
    expect(drift).toBeLessThan(50)
  })

  it('forwards an announced world to both the brain and the renderer', () => {
    const swim = createSwim()
    const pondBefore = renderer.ponds
    swim.setPond({
      width: 900,
      height: 600,
      margin: 100,
      fishLength: 120,
      view: { x: 0, y: 0, width: 900, height: 600 },
      depthLevels: 7,
      reducedMotion: false,
    })
    raf.tick(1000)
    // why: The renderer re-derives its camera from the new world, and the brain steers by it — the frame that follows must have drawn against it.
    expect(renderer.ponds).toBe(pondBefore + 1)
    expect(renderer.last?.length).toBeGreaterThan(0)
  })

  it('stops measuring its own window once a host has announced a world', () => {
    const swim = createSwim()
    const standaloneBefore = renderer.ponds
    window.dispatchEvent(new Event('resize'))
    // why: Standalone the window is the pond, so a browser resize is a world change the koi must adopt.
    expect(renderer.ponds).toBe(standaloneBefore + 1)
    swim.setPond({
      width: 900,
      height: 600,
      margin: 100,
      fishLength: 120,
      view: { x: 0, y: 0, width: 900, height: 600 },
      depthLevels: 7,
      reducedMotion: false,
    })
    const hostedBefore = renderer.ponds
    window.dispatchEvent(new Event('resize'))
    // why: Once a host has spoken its announcements are authoritative and arrive on every resize; a window-measured world would briefly undo a card-scaled one.
    expect(renderer.ponds).toBe(hostedBefore)
  })
})
