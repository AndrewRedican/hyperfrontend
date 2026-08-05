import { describe, expect, it, vi } from 'vitest'
import { createHeartbeatAudio } from '../heartbeat-audio'

/** Builds a structural stand-in for AudioContext that records scheduling. */
function createFakeContext(options: { refuseResume?: boolean } = {}) {
  const started: string[] = []
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn<(value: number, startTime: number) => void>(),
    linearRampToValueAtTime: vi.fn<(value: number, endTime: number) => void>(),
    exponentialRampToValueAtTime: vi.fn<(value: number, endTime: number) => void>(),
  })
  const fake = {
    state: <'suspended' | 'running'>'suspended',
    currentTime: 0,
    destination: {},
    async resume() {
      if (options.refuseResume === true) {
        throw new Error('user gesture required')
      }
      fake.state = 'running'
    },
    async suspend() {
      fake.state = 'suspended'
    },
    createDynamicsCompressor: () => ({
      threshold: param(),
      knee: param(),
      ratio: param(),
      attack: param(),
      release: param(),
      connect: vi.fn<(target: unknown) => void>(),
    }),
    createOscillator: () => {
      const osc = {
        type: 'sine',
        frequency: param(),
        onended: <(() => void) | null>null,
        connect: vi.fn<(target: unknown) => void>(),
        disconnect: vi.fn<() => void>(),
        start: (at: number) => {
          started.push(`osc@${at}`)
        },
        stop: vi.fn<(at: number) => void>(),
      }
      return osc
    },
    createGain: () => ({
      gain: param(),
      connect: vi.fn<(target: unknown) => void>(),
      disconnect: vi.fn<() => void>(),
    }),
  }
  return { fake, started }
}

/** Casts the fake through unknown into the DOM type the module expects. */
function asContext(fake: unknown): AudioContext {
  return <AudioContext>fake
}

describe('enable', () => {
  it('reports running audio with a working context', async () => {
    const { fake } = createFakeContext()
    const audio = createHeartbeatAudio(() => asContext(fake))
    await expect(audio.enable()).resolves.toBe(true)
  })

  it('reports unavailable audio without Web Audio support', async () => {
    const audio = createHeartbeatAudio(() => null)
    await expect(audio.enable()).resolves.toBe(false)
  })

  it('turns an autoplay refusal into a muted outcome instead of a throw', async () => {
    const { fake } = createFakeContext({ refuseResume: true })
    const audio = createHeartbeatAudio(() => asContext(fake))
    await expect(audio.enable()).resolves.toBe(false)
  })

  it('the default factory yields no audio in a DOM without AudioContext', async () => {
    const audio = createHeartbeatAudio()
    await expect(audio.enable()).resolves.toBe(false)
  })
})

describe('playBeat', () => {
  it('schedules nothing before enable', () => {
    const { fake, started } = createFakeContext()
    const audio = createHeartbeatAudio(() => asContext(fake))
    audio.playBeat()
    expect(started).toHaveLength(0)
  })

  it('schedules the lub and the dub after enable', async () => {
    const { fake, started } = createFakeContext()
    const audio = createHeartbeatAudio(() => asContext(fake))
    await audio.enable()
    audio.playBeat()
    expect(started).toHaveLength(2)
  })

  it('schedules nothing after disable', async () => {
    const { fake, started } = createFakeContext()
    const audio = createHeartbeatAudio(() => asContext(fake))
    await audio.enable()
    audio.disable()
    audio.playBeat()
    expect(started).toHaveLength(0)
  })

  it('re-enabling resumes scheduling', async () => {
    const { fake, started } = createFakeContext()
    const audio = createHeartbeatAudio(() => asContext(fake))
    await audio.enable()
    audio.disable()
    await audio.enable()
    audio.playBeat()
    expect(started).toHaveLength(2)
  })

  it('caps stacked voices instead of scheduling without bound', async () => {
    const { fake, started } = createFakeContext()
    const audio = createHeartbeatAudio(() => asContext(fake))
    await audio.enable()
    for (let index = 0; index < 9; index += 1) {
      audio.playBeat()
    }
    expect(started).toHaveLength(12)
  })
})

describe('state', () => {
  it('reflects enablement through isEnabled', async () => {
    const { fake } = createFakeContext()
    const audio = createHeartbeatAudio(() => asContext(fake))
    const before = audio.isEnabled()
    await audio.enable()
    expect([before, audio.isEnabled()]).toEqual([false, true])
  })
})
