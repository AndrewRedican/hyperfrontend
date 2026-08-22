import type { NeighborObservation } from '../../model/types.js'
import type { FeatureLink, KoiRuntime } from '../wire.js'
import { describe, expect, it } from 'vitest'
import { koiFishContract } from '../koi-fish.contract.js'
import { wireKoiContract } from '../wire.js'

/** One call the wiring made on the runtime it drives. */
interface RuntimeCall {
  /** The runtime method that was called. */
  method: string
  /** What it was called with. */
  args: readonly unknown[]
}

/** A koi runtime wired to a link, with everything either side did written down. */
interface WiredKoi {
  /** Every call the wiring made on the runtime, in order. */
  calls: readonly RuntimeCall[]
  /** Every action the runtime emitted through the link, in order. */
  sent: ReadonlyArray<{ type: string; data: unknown }>
  /** The actions the wiring subscribed to. */
  events: readonly string[]
  /** Delivers one host action to the wiring.
   *
   * @param event - The action type the host sent.
   * @param data - Its payload.
   */
  deliver(event: string, data?: unknown): void
  /**
   * Emits one action the way the runtime does.
   *
   * @param type - The action type to emit.
   * @param data - Its payload.
   */
  emit(type: string, data?: unknown): void
}

/** A koi cruising north-east, close enough to steer around. */
const NEIGHBOR: NeighborObservation = { framework: 'lit', x: 120, y: 80, heading: 0.4, speed: 30, depth: 3, length: 200, girth: 24 }

/**
 * Wires a recording runtime to a recording link.
 *
 * @returns The wired pair, and the two ways to drive it.
 */
function wireRecorder(): WiredKoi {
  const calls: RuntimeCall[] = []
  const sent: Array<{ type: string; data: unknown }> = []
  const handlers = new Map<string, (data: unknown) => void>()
  let emitter: (type: string, data?: unknown) => void = () => undefined
  const record =
    (method: string) =>
    (...args: unknown[]): void => {
      calls.push({ method, args })
    }
  const link: FeatureLink = {
    on: (event, handler) => handlers.set(event, handler),
    send: (type, data) => sent.push({ type, data }),
  }
  const koi: KoiRuntime = {
    setPond: record('setPond'),
    adopt: record('adopt'),
    setDepth: record('setDepth'),
    startle: record('startle'),
    observe: record('observe'),
    setHovered: record('setHovered'),
    setPaused: record('setPaused'),
    setInspected: record('setInspected'),
    placeAt: record('placeAt'),
    dispose: record('dispose'),
    connect: (emit) => {
      emitter = emit
    },
  }
  wireKoiContract(link, koi)
  return {
    calls,
    sent,
    events: [...handlers.keys()],
    deliver: (event, data) => handlers.get(event)?.(data),
    emit: (type, data) => emitter(type, data),
  }
}

describe('wireKoiContract', () => {
  it('listens for every action the contract accepts, and for the channel closing', () => {
    expect(wireRecorder().events).toEqual(expect.arrayContaining([...koiFishContract.accepted.map((action) => action.type), 'close']))
  })

  it('adopts the world the host announced', () => {
    const wired = wireRecorder()
    wired.deliver('pond', { width: 1600, height: 900 })
    expect(wired.calls).toEqual([{ method: 'setPond', args: [{ width: 1600, height: 900 }] }])
  })

  it('adopts the identity the host assigned, ordinal and all', () => {
    const wired = wireRecorder()
    wired.deliver('identity', { framework: 'vanilla', seed: 3, instance: 2, url: 'https://koi.test/', depth: 4 })
    expect(wired.calls).toEqual([
      { method: 'adopt', args: [{ framework: 'vanilla', seed: 3, instance: 2, url: 'https://koi.test/', depth: 4 }] },
    ])
  })

  it('unwraps the level a depth grant carries', () => {
    const wired = wireRecorder()
    wired.deliver('depth', { level: 5 })
    expect(wired.calls).toEqual([{ method: 'setDepth', args: [5] }])
  })

  it('passes a strike on the water through as it stands', () => {
    const wired = wireRecorder()
    wired.deliver('disturbance', { x: 40, y: 60, intensity: 1 })
    expect(wired.calls).toEqual([{ method: 'startle', args: [{ x: 40, y: 60, intensity: 1 }] }])
  })

  it('unwraps whether the pointer is over this koi', () => {
    const wired = wireRecorder()
    wired.deliver('hover', { hovered: true })
    expect(wired.calls).toEqual([{ method: 'setHovered', args: [true] }])
  })

  it('unwraps whether the pond told this koi to hold still', () => {
    const wired = wireRecorder()
    wired.deliver('sleep', { paused: true })
    expect(wired.calls).toEqual([{ method: 'setPaused', args: [true] }])
  })

  it('holds a koi for inspection when nothing says the hold is a rest', () => {
    const wired = wireRecorder()
    wired.deliver('pause', { paused: true })
    expect(wired.calls).toEqual([{ method: 'setInspected', args: [true, false] }])
  })

  it('holds a koi at rest when the pond asks for one', () => {
    const wired = wireRecorder()
    wired.deliver('pause', { paused: true, resting: true })
    expect(wired.calls).toEqual([{ method: 'setInspected', args: [true, true] }])
  })

  it('releases a held koi with the hold it was under', () => {
    const wired = wireRecorder()
    wired.deliver('pause', { paused: false, resting: true })
    expect(wired.calls).toEqual([{ method: 'setInspected', args: [false, true] }])
  })

  it('carries a held koi to the point it is dragged to', () => {
    const wired = wireRecorder()
    wired.deliver('place', { x: 210, y: 340 })
    expect(wired.calls).toEqual([{ method: 'placeAt', args: [{ x: 210, y: 340 }] }])
  })

  it('observes the neighbours a relay is worth steering around', () => {
    const wired = wireRecorder()
    wired.deliver('neighbors', [NEIGHBOR])
    expect(wired.calls).toEqual([{ method: 'observe', args: [[NEIGHBOR]] }])
  })

  it('thins a shoal of what it cannot steer around instead of crashing the frame', () => {
    const wired = wireRecorder()
    wired.deliver('neighbors', [null, { ...NEIGHBOR, girth: 'wide' }, { framework: 'vue' }, NEIGHBOR])
    expect(wired.calls).toEqual([{ method: 'observe', args: [[NEIGHBOR]] }])
  })

  it('observes nobody when the relay is not a shoal at all', () => {
    const wired = wireRecorder()
    wired.deliver('neighbors', { framework: 'vue' })
    expect(wired.calls).toEqual([{ method: 'observe', args: [[]] }])
  })

  it('drops the hover and the shoal when the channel closes', () => {
    const wired = wireRecorder()
    wired.deliver('close')
    expect(wired.calls).toEqual([
      { method: 'setHovered', args: [false] },
      { method: 'observe', args: [[]] },
    ])
  })

  it('sends what the koi emits, down to the fields no schema describes', () => {
    const wired = wireRecorder()
    wired.emit('outline', { framework: 'vanilla', spine: [{ x: 1, y: 2 }], path: [{ x: 3, y: 4 }], mood: 'inscrutable' })
    expect(wired.sent).toEqual([
      { type: 'outline', data: { framework: 'vanilla', spine: [{ x: 1, y: 2 }], path: [{ x: 3, y: 4 }], mood: 'inscrutable' } },
    ])
  })

  it('sends an action that carries no payload', () => {
    const wired = wireRecorder()
    wired.emit('settled')
    expect(wired.sent).toEqual([{ type: 'settled', data: undefined }])
  })
})
