import type { PondLink, PondScene, SceneScale } from '../wire-contract'
import { describe, expect, it } from 'vitest'
import { SCENE_FALLBACK_MS, createPondReporter, wirePondContract, wireSceneBoot } from '../wire-contract'

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

/** A fake handle and scene wired only to the boot decision, with a hand-driven clock. */
function createBootHarness(hosted: boolean) {
  const handlers = new Map<string, (data: unknown) => void>()
  const scales: SceneScale[] = []
  const deadlines: Array<{ callback: () => void; afterMs: number }> = []

  const link: PondLink = {
    on(event, handler) {
      handlers.set(event, handler)
      return () => handlers.delete(event)
    },
    send() {},
  }

  const scene: PondScene = {
    setScale: (scale) => scales.push(scale),
    disturbAt: () => {},
  }

  wireSceneBoot(link, scene, {
    hosted,
    schedule: (callback, afterMs) => {
      deadlines.push({ callback, afterMs })
    },
  })

  /**
   * Delivers one host announcement to the boot wiring.
   *
   * @param event - The event type.
   * @param data - Its payload.
   */
  const emit = (event: string, data: unknown): void => {
    handlers.get(event)?.(data)
  }

  /** Runs every armed deadline, as the clock would. */
  const expire = (): void => {
    for (const deadline of deadlines) {
      deadline.callback()
    }
  }

  return { scales, deadlines, emit, expire }
}

describe('the boot decision', () => {
  it('opens the full scene in the same tick when no host exists', () => {
    expect(createBootHarness(false).scales).toEqual(['full'])
  })

  it('arms no deadline when no host exists', () => {
    expect(createBootHarness(false).deadlines).toEqual([])
  })

  it('opens nothing while a host has not spoken', () => {
    expect(createBootHarness(true).scales).toEqual([])
  })

  it('holds the fallback to the deadline', () => {
    expect(createBootHarness(true).deadlines).toEqual([expect.objectContaining({ afterMs: SCENE_FALLBACK_MS })])
  })

  it('opens the full scene when a silent host forfeits its say', () => {
    const harness = createBootHarness(true)
    harness.expire()
    expect(harness.scales).toEqual(['full'])
  })

  it('stands the fallback down once the host names a scene', () => {
    const harness = createBootHarness(true)
    harness.emit('set-scene', { scene: 'card' })
    harness.expire()
    // why: The contract wiring routes the scale itself; the boot only had to not second-guess it a second later.
    expect(harness.scales).toEqual([])
  })

  it('reads any presentation but embedded as the full scene, immediately', () => {
    const harness = createBootHarness(true)
    harness.emit('presentation', { mode: 'dialog' })
    expect(harness.scales).toEqual(['full'])
  })

  it('keeps waiting through an embedded presentation', () => {
    const harness = createBootHarness(true)
    harness.emit('presentation', { mode: 'embedded' })
    expect(harness.scales).toEqual([])
  })

  it('lets a named scene outrank a presentation that follows it', () => {
    const harness = createBootHarness(true)
    harness.emit('set-scene', { scene: 'card' })
    harness.emit('presentation', { mode: 'dialog' })
    expect(harness.scales).toEqual([])
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
