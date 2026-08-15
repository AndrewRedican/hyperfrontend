import type { KoiState } from '../../koi/koi-motion'
import type { KoiRenderer } from '../../koi/koi-render'
import type { KoiRendererFactory } from '../koi-runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createKoiRuntime } from '../koi-runtime'

/** A renderer stand-in recording what the loop asked it to draw. */
interface FakeRenderer extends KoiRenderer {
  draws: number
  selections: boolean[]
  cardUpdates: number
  disposed: number
  last: KoiState | null
  panel: ReturnType<KoiRenderer['cardRects']>
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
    selections: [],
    cardUpdates: 0,
    disposed: 0,
    last: null,
    panel: null,
    draw(state) {
      fake.draws += 1
      fake.last = state
    },
    setPond() {},
    setHovered() {},
    setSelected(selected) {
      fake.selections.push(selected)
    },
    updateCard() {
      fake.cardUpdates += 1
    },
    placeCard() {},
    cardRects() {
      return fake.panel
    },
    dispose() {
      fake.disposed += 1
    },
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
  const cancel = (): void => {
    pending = null
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
  return { request, cancel, tick, waiting: () => pending !== null }
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
    vi.stubGlobal('cancelAnimationFrame', raf.cancel)
    window.requestAnimationFrame = raf.request
    window.cancelAnimationFrame = raf.cancel
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
    const outline = <{ speed: number }>sent.filter((action) => action.type === 'outline').at(-1)?.data
    expect(outline.speed).toBe(0)
    runtime.setInspected(false)
    for (let ts = 3216; ts <= 4300; ts += 16) {
      raf.tick(ts)
    }
    const resumed = lastNose(sent)
    expect(Math.hypot(resumed.x - held.x, resumed.y - held.y)).toBeGreaterThan(10)
  })

  it('carries the card panel on the outline only while the card shows', () => {
    const runtime = createKoiRuntime(root, build)
    const sent = emissions(runtime)
    const lastOutline = (): Record<string, unknown> =>
      <Record<string, unknown>>sent.filter((action) => action.type === 'outline').at(-1)?.data
    raf.tick(1000)
    expect(lastOutline()).not.toHaveProperty('card')
    renderer.panel = {
      frame: { x: 300, y: 180, width: 220, height: 96 },
      app: { x: 312, y: 220, width: 180, height: 14 },
      site: { x: 312, y: 250, width: 120, height: 13 },
    }
    raf.tick(1101)
    expect((<{ frame: object }>lastOutline()['card']).frame).toEqual({ x: 300, y: 180, width: 220, height: 96 })
  })

  it('holds the card open through the hold and tears the inspector down on release', () => {
    vi.useFakeTimers()
    try {
      const runtime = createKoiRuntime(root, build)
      runtime.setInspected(true)
      expect(renderer.selections.at(-1)).toBe(true)
      const opened = renderer.cardUpdates
      expect(opened).toBeGreaterThan(0)
      vi.advanceTimersByTime(1100)
      expect(renderer.cardUpdates).toBeGreaterThan(opened)
      runtime.setInspected(false)
      expect(renderer.selections.at(-1)).toBe(false)
      const closed = renderer.cardUpdates
      // why: Everything that exists only to power the card must stop with the release — a timer still rewriting rows after this is a leak.
      vi.advanceTimersByTime(5000)
      expect(renderer.cardUpdates).toBe(closed)
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports its memory honestly as unavailable where the browser cannot attribute it', async () => {
    vi.useFakeTimers()
    try {
      const runtime = createKoiRuntime(root, build)
      const updates: string[] = []
      renderer.updateCard = (details): void => {
        updates.push(details.memoryState)
      }
      runtime.setInspected(true)
      // why: jsdom has no measureUserAgentSpecificMemory and no isolation — the honest reading is `unavailable`, never a share of somebody else's heap.
      await vi.advanceTimersByTimeAsync(1100)
      expect(updates.at(-1)).toBe('unavailable')
      runtime.setInspected(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('hands a placement straight to the brain and reports the outline from the new spot', () => {
    const runtime = createKoiRuntime(root, build)
    const sent = emissions(runtime)
    runtime.setInspected(true)
    runtime.placeAt({ x: 222, y: 333 })
    raf.tick(1000)
    expect(lastNose(sent)).toEqual({ x: 222, y: 333 })
  })

  it('cancels its animation frame outright while asleep', () => {
    const runtime = createKoiRuntime(root, build)
    raf.tick(1000)
    runtime.setPaused(true)
    // why: A sleeping koi must not even hold a pending callback — seven hidden frames each waking per frame is the battery cost sleep exists to remove.
    expect(raf.waiting()).toBe(false)
    runtime.setPaused(false)
    expect(raf.waiting()).toBe(true)
  })

  it('resumes from sleep without a false stall', () => {
    const runtime = createKoiRuntime(root, build)
    const sent = emissions(runtime)
    raf.tick(1000)
    const before = lastNose(sent)
    runtime.setPaused(true)
    runtime.setPaused(false)
    // why: The first frame back starts a fresh clock — an hour asleep must not arrive as one clamped leap of travel.
    raf.tick(3_601_000)
    raf.tick(3_601_016)
    const after = lastNose(sent)
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(10)
  })

  it('tears everything down on dispose', () => {
    const runtime = createKoiRuntime(root, build)
    raf.tick(1000)
    runtime.dispose()
    expect(renderer.disposed).toBe(1)
    expect(raf.waiting()).toBe(false)
    // why: A disposed koi stays disposed — waking it up again would leak the very loop dispose exists to stop.
    runtime.setPaused(false)
    expect(raf.waiting()).toBe(false)
  })
})
