import type { PondLink, PondScene, SceneScale } from '../wire-contract'
import { describe, expect, it } from 'vitest'
import { createPondReporter, wirePondContract } from '../wire-contract'

/** A fake feature handle plus a scene recording everything the contract drives. */
function createHarness() {
  const handlers = new Map<string, (data: unknown) => void>()
  const sends: Array<{ type: string; data: unknown }> = []
  const scales: SceneScale[] = []
  const strikes: Array<{ fx: number; fy: number }> = []

  const link: PondLink = {
    on(event, handler) {
      handlers.set(event, handler)
      return () => handlers.delete(event)
    },
    send(type, data) {
      sends.push({ type, data })
    },
  }

  const scene: PondScene = {
    setScale: (scale) => scales.push(scale),
    disturbAt: (fx, fy) => strikes.push({ fx, fy }),
  }

  wirePondContract(link, scene)

  /**
   * Delivers one contract action to the wiring.
   *
   * @param event - The action type.
   * @param data - Its payload.
   */
  const emit = (event: string, data: unknown): void => {
    handlers.get(event)?.(data)
  }

  return { link, sends, scales, strikes, emit }
}

describe('set-scene', () => {
  it('adopts a card-sized presentation', () => {
    const harness = createHarness()
    harness.emit('set-scene', { scene: 'card' })
    expect(harness.scales).toEqual(['card'])
  })

  it('adopts the full scene', () => {
    const harness = createHarness()
    harness.emit('set-scene', { scene: 'full' })
    expect(harness.scales).toEqual(['full'])
  })

  it('reads an unrecognised scale as the full scene rather than refusing it', () => {
    const harness = createHarness()
    harness.emit('set-scene', { scene: 'billboard' })
    expect(harness.scales).toEqual(['full'])
  })
})

describe('disturb', () => {
  it('strikes the water where the gallery asked', () => {
    const harness = createHarness()
    harness.emit('disturb', { fx: 0.25, fy: 0.75 })
    expect(harness.strikes).toEqual([{ fx: 0.25, fy: 0.75 }])
  })
})

describe('createPondReporter', () => {
  it('reports the connected shoal', () => {
    const harness = createHarness()
    createPondReporter(harness.link).shoal(5, 7)
    expect(harness.sends).toEqual([{ type: 'shoal', data: { connected: 5, expected: 7 } }])
  })

  it('reports a sequence that finished unwinding', () => {
    const harness = createHarness()
    createPondReporter(harness.link).sequenceComplete(7)
    expect(harness.sends).toEqual([{ type: 'sequence-complete', data: { fish: 7 } }])
  })
})
