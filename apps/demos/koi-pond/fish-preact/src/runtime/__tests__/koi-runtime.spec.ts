import type { KoiTune } from '@hyperfrontend/demo-koi-lib'
import type { KoiState } from '../../koi/koi-motion'
import type { KoiRenderer } from '../../koi/koi-render'
import type { KoiRendererFactory } from '../koi-runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createKoiRuntime } from '../koi-runtime'

/** A renderer stand-in recording what the loop asked it to draw. */
interface FakeRenderer extends KoiRenderer {
  draws: number
  ponds: number
  hovers: boolean[]
  tunes: KoiTune[]
  last: KoiState | null
}

/**
 * Builds the renderer stand-in the runtime drives.
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

describe('createKoiRuntime', () => {
  let root: HTMLElement
  let renderer: FakeRenderer
  let raf: ReturnType<typeof createRaf>
  const build: KoiRendererFactory = () => renderer

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>'
    root = <HTMLElement>document.querySelector('#app')
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
   * Collects every action a runtime emits.
   *
   * @param runtime - The runtime to listen to.
   * @returns The emitted actions in order.
   */
  function emissions(runtime: ReturnType<typeof createKoiRuntime>): { type: string; data: unknown }[] {
    const out: { type: string; data: unknown }[] = []
    runtime.connect((type, data) => out.push({ type, data }))
    return out
  }

  /**
   * Reads the nose of the last outline a runtime reported.
   *
   * @param sent - The runtime's emissions.
   * @returns The nose in pond space.
   */
  function lastNose(sent: { type: string; data: unknown }[]): { x: number; y: number } {
    const outline = <{ spine: { x: number; y: number }[] }>sent.filter((action) => action.type === 'outline').at(-1)?.data
    const nose = outline.spine[0]
    if (nose === undefined) {
      throw new Error('an outline was reported with no spine')
    }
    return nose
  }

  /**
   * Reads the speed of the last outline a runtime reported.
   *
   * @param sent - The runtime's emissions.
   * @returns The reported speed in pixels per second.
   */
  function lastSpeed(sent: { type: string; data: unknown }[]): number {
    const outline = <{ speed: number }>sent.filter((action) => action.type === 'outline').at(-1)?.data
    return outline.speed
  }

  it('draws a frame each tick', () => {
    createKoiRuntime(root, build)
    raf.tick(1000)
    raf.tick(1016)
    expect(renderer.draws).toBe(2)
  })

  it('holds still while paused and resumes after', () => {
    const runtime = createKoiRuntime(root, build)
    const sent = emissions(runtime)
    runtime.setPaused(true)
    raf.tick(1000)
    raf.tick(2000)
    expect(renderer.draws).toBe(0)
    expect(sent).toHaveLength(0)
    runtime.setPaused(false)
    raf.tick(3000)
    expect(renderer.draws).toBe(1)
  })

  it('holds its position for inspection while still sculling and reporting', () => {
    const runtime = createKoiRuntime(root, build)
    const sent = emissions(runtime)
    raf.tick(1000)
    raf.tick(1101)
    const before = lastNose(sent)
    runtime.setInspected(true)
    for (let ts = 1116; ts <= 3200; ts += 16) {
      raf.tick(ts)
    }
    const held = lastNose(sent)
    // why: An inspected koi is stopped to be looked at — it must stay put, keep drawing its idle scull, and keep reporting so hover identity still works.
    expect(Math.hypot(held.x - before.x, held.y - before.y)).toBeLessThan(1)
    expect(renderer.draws).toBeGreaterThan(100)
    expect(lastSpeed(sent)).toBe(0)
    runtime.setInspected(false)
    for (let ts = 3216; ts <= 4300; ts += 16) {
      raf.tick(ts)
    }
    const resumed = lastNose(sent)
    expect(Math.hypot(resumed.x - held.x, resumed.y - held.y)).toBeGreaterThan(10)
  })

  it('routes the playground tune to both the brain and the renderer', () => {
    const tuned = createKoiRuntime(root, build)
    const tunedSent = emissions(tuned)
    tuned.applyTune({ speedScale: 0.4 })
    for (let ts = 1000; ts <= 3000; ts += 16) {
      raf.tick(ts)
    }
    expect(renderer.tunes).toEqual([{ speedScale: 0.4 }])
    const tunedSpeed = lastSpeed(tunedSent)

    // why: A second, untuned runtime swims the identical deterministic course, so its reported speed is the honest baseline proving the brain actually took the scale.
    renderer = fakeRenderer()
    const cruising = createKoiRuntime(root, build)
    const cruisingSent = emissions(cruising)
    for (let ts = 1000; ts <= 3000; ts += 16) {
      raf.tick(ts)
    }
    expect(tunedSpeed).toBeLessThan(lastSpeed(cruisingSent) * 0.6)
  })

  it('forwards an announced world to both the brain and the renderer', () => {
    const runtime = createKoiRuntime(root, build)
    const pondBefore = renderer.ponds
    runtime.setPond({
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
})
