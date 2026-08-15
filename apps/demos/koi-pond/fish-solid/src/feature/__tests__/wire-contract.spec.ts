import type { Disturbance, KoiIdentity, NeighborObservation, PondEnvironment } from '@hyperfrontend/demo-koi-lib'
import type { FeatureLink, KoiRuntime } from '../wire-contract'
import { describe, expect, it } from 'vitest'
import { describePond } from '@hyperfrontend/demo-koi-lib'
import { wireKoiContract } from '../wire-contract'

/** A fake feature handle capturing subscriptions and sends, plus a runtime recording every call. */
function createHarness() {
  const handlers = new Map<string, (data: unknown) => void>()
  const sends: Array<{ type: string; data: unknown }> = []
  const calls: Array<{ method: string; value: unknown }> = []

  const link: FeatureLink = {
    on(event, handler) {
      handlers.set(event, handler)
      return () => handlers.delete(event)
    },
    send(type, data) {
      sends.push({ type, data })
    },
  }

  const koi: KoiRuntime = {
    setPond: (pond: PondEnvironment) => calls.push({ method: 'setPond', value: pond }),
    adopt: (identity: KoiIdentity) => calls.push({ method: 'adopt', value: identity }),
    setDepth: (level: number) => calls.push({ method: 'setDepth', value: level }),
    startle: (disturbance: Disturbance) => calls.push({ method: 'startle', value: disturbance }),
    observe: (neighbors: readonly NeighborObservation[]) => calls.push({ method: 'observe', value: neighbors }),
    setHovered: (hovered: boolean) => calls.push({ method: 'setHovered', value: hovered }),
    setPaused: (paused: boolean) => calls.push({ method: 'setPaused', value: paused }),
    setInspected: (inspected: boolean) => calls.push({ method: 'setInspected', value: inspected }),
    placeAt: (point: { x: number; y: number }) => calls.push({ method: 'placeAt', value: point }),
    dispose: () => calls.push({ method: 'dispose', value: null }),
    connect: (emit: (type: string, data?: unknown) => void) => calls.push({ method: 'connect', value: emit }),
  }

  wireKoiContract(link, koi)

  /**
   * Delivers one contract action to the wiring.
   *
   * @param event - The action type.
   * @param data - Its payload.
   */
  const emit = (event: string, data: unknown): void => {
    handlers.get(event)?.(data)
  }

  /**
   * Reads the value the runtime was last called with for a method.
   *
   * @param method - The runtime method.
   * @returns The last value, or undefined when it was never called.
   */
  const lastCall = (method: string): unknown => calls.filter((call) => call.method === method).at(-1)?.value

  return { link, sends, calls, emit, lastCall }
}

/** A neighbour the relay would send. */
const NEIGHBOR: NeighborObservation = { framework: 'lit', x: 10, y: 20, heading: 0.5, speed: 90, depth: 4, length: 120, girth: 14 }

describe('outbound wiring', () => {
  it('hands the runtime a channel to emit on', () => {
    expect(createHarness().calls.some((call) => call.method === 'connect')).toBe(true)
  })

  it('routes what the runtime emits onto the feature handle', () => {
    const harness = createHarness()
    const emit = <(type: string, data?: unknown) => void>harness.lastCall('connect')
    emit('outline', { framework: 'solid' })
    expect(harness.sends).toEqual([{ type: 'outline', data: { framework: 'solid' } }])
  })
})

describe('inbound wiring', () => {
  it('adopts an announced world', () => {
    const harness = createHarness()
    const pond = describePond(900, 600, 900, 600, false)
    harness.emit('pond', pond)
    expect(harness.lastCall('setPond')).toEqual(pond)
  })

  it('takes the identity the host assigned', () => {
    const harness = createHarness()
    harness.emit('identity', { framework: 'solid', seed: 4885, url: 'https://pond.test/fish-solid/', depth: 2 })
    expect(harness.lastCall('adopt')).toEqual({ framework: 'solid', seed: 4885, url: 'https://pond.test/fish-solid/', depth: 2 })
  })

  it('unwraps a depth grant to the level itself', () => {
    const harness = createHarness()
    harness.emit('depth', { level: 5 })
    expect(harness.lastCall('setDepth')).toBe(5)
  })

  it('passes a disturbance through untouched', () => {
    const harness = createHarness()
    harness.emit('disturbance', { x: 40, y: 90, intensity: 0.8 })
    expect(harness.lastCall('startle')).toEqual({ x: 40, y: 90, intensity: 0.8 })
  })

  it('unwraps a hover notice to the flag itself, either way', () => {
    const harness = createHarness()
    harness.emit('hover', { hovered: true })
    expect(harness.lastCall('setHovered')).toBe(true)
    // why: Asserting the false case too is what stops a wiring that hard-coded `true` from passing.
    harness.emit('hover', { hovered: false })
    expect(harness.lastCall('setHovered')).toBe(false)
  })

  it('unwraps a sleep notice to the flag itself, either way', () => {
    const harness = createHarness()
    harness.emit('sleep', { paused: true })
    expect(harness.lastCall('setPaused')).toBe(true)
    harness.emit('sleep', { paused: false })
    expect(harness.lastCall('setPaused')).toBe(false)
  })

  it('carries a placement point through to the runtime', () => {
    const harness = createHarness()
    harness.emit('place', { x: 512, y: 384 })
    expect(harness.lastCall('placeAt')).toEqual({ x: 512, y: 384 })
  })

  it('unwraps an inspection pause to the flag itself, either way', () => {
    const harness = createHarness()
    harness.emit('pause', { paused: true })
    expect(harness.lastCall('setInspected')).toBe(true)
    harness.emit('pause', { paused: false })
    expect(harness.lastCall('setInspected')).toBe(false)
  })
})

describe('relayed neighbours', () => {
  it('passes a well-formed shoal straight through', () => {
    const harness = createHarness()
    harness.emit('neighbors', [NEIGHBOR])
    expect(harness.lastCall('observe')).toEqual([NEIGHBOR])
  })

  it('drops an entry missing the framework that identifies it', () => {
    const harness = createHarness()
    harness.emit('neighbors', [{ ...NEIGHBOR, framework: undefined }])
    expect(harness.lastCall('observe')).toEqual([])
  })

  it('drops an entry whose position never arrived', () => {
    const harness = createHarness()
    harness.emit('neighbors', [{ ...NEIGHBOR, x: 'over there' }])
    expect(harness.lastCall('observe')).toEqual([])
  })

  it('drops an entry whose girth never arrived', () => {
    const harness = createHarness()
    harness.emit('neighbors', [{ ...NEIGHBOR, girth: undefined }])
    expect(harness.lastCall('observe')).toEqual([])
  })

  it('keeps the usable neighbours when one entry is malformed', () => {
    const harness = createHarness()
    harness.emit('neighbors', [null, NEIGHBOR])
    expect(harness.lastCall('observe')).toEqual([NEIGHBOR])
  })

  it('empties the shoal when the relay sends something that is not a list', () => {
    const harness = createHarness()
    harness.emit('neighbors', { framework: 'lit' })
    expect(harness.lastCall('observe')).toEqual([])
  })
})

describe('close', () => {
  it('drops any hover the host had set', () => {
    const harness = createHarness()
    harness.emit('hover', { hovered: true })
    harness.emit('close', undefined)
    expect(harness.lastCall('setHovered')).toBe(false)
  })

  it('forgets the shoal it can no longer hear about', () => {
    const harness = createHarness()
    harness.emit('neighbors', [NEIGHBOR])
    harness.emit('close', undefined)
    expect(harness.lastCall('observe')).toEqual([])
  })
})
