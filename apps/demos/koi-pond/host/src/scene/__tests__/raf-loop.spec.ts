import type { FrameLoopHost, FrameTick } from '../raf-loop'
import { describe, expect, it } from 'vitest'
import { MAX_FRAME_S, createFrameLoop } from '../raf-loop'

/** A hand-driven frame host, so the loop can be stepped without a browser. */
function createHarness() {
  const ticks: FrameTick[] = []
  let pending: ((timestamp: number) => void) | null = null
  let cancelled = 0
  let clock = 1000
  let handle = 0

  const host: FrameLoopHost = {
    requestFrame(callback) {
      pending = callback
      handle += 1
      return handle
    },
    cancelFrame() {
      cancelled += 1
      pending = null
    },
    now: () => clock,
  }

  const loop = createFrameLoop((tick) => ticks.push(tick), host)

  /**
   * Advances the clock and runs the pending frame.
   *
   * @param ms - Milliseconds to advance before the frame runs.
   */
  const step = (ms: number): void => {
    clock += ms
    const run = pending
    pending = null
    run?.(clock)
  }

  return { loop, ticks, step, cancelled: () => cancelled, isPending: () => pending !== null }
}

describe('createFrameLoop', () => {
  it('requests nothing until it is started', () => {
    expect(createHarness().isPending()).toBe(false)
  })

  it('reports itself stopped before it starts', () => {
    expect(createHarness().loop.isRunning).toBe(false)
  })

  it('requests a frame once started', () => {
    const harness = createHarness()
    harness.loop.start()
    expect(harness.isPending()).toBe(true)
  })

  it('reports the elapsed seconds between frames', () => {
    const harness = createHarness()
    harness.loop.start()
    harness.step(16)
    expect(harness.ticks[0]?.dt).toBeCloseTo(0.016)
  })

  it('clamps a frame that arrived after the tab woke from the background', () => {
    const harness = createHarness()
    harness.loop.start()
    harness.step(120_000)
    expect(harness.ticks[0]?.dt).toBe(MAX_FRAME_S)
  })

  it('keeps requesting frames as long as it runs', () => {
    const harness = createHarness()
    harness.loop.start()
    harness.step(16)
    harness.step(16)
    expect(harness.ticks).toHaveLength(2)
  })

  it('counts elapsed time from the moment it first started', () => {
    const harness = createHarness()
    harness.loop.start()
    harness.step(16)
    harness.step(16)
    expect(harness.ticks[1]?.elapsedMs).toBe(32)
  })

  it('ignores a second start while it is already running', () => {
    const harness = createHarness()
    harness.loop.start()
    harness.loop.start()
    harness.step(16)
    expect(harness.ticks).toHaveLength(1)
  })

  it('releases its frame request when stopped', () => {
    const harness = createHarness()
    harness.loop.start()
    harness.loop.stop()
    expect(harness.cancelled()).toBe(1)
  })

  it('ignores a stop when it was never running', () => {
    const harness = createHarness()
    harness.loop.stop()
    expect(harness.cancelled()).toBe(0)
  })

  it('does not jump the shoal forward over the time it spent stopped', () => {
    const harness = createHarness()
    harness.loop.start()
    harness.step(16)
    harness.loop.stop()
    harness.loop.start()
    harness.step(16)
    expect(harness.ticks[1]?.dt).toBeCloseTo(0.016)
  })
})
