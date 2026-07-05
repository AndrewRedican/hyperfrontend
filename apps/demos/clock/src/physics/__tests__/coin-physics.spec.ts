import { describe, expect, it, vi } from 'vitest'
import { createCoinPhysics, faceAt } from '../coin-physics'
import type { CoinPhysics, SettleHandler } from '../coin-physics'

/** Advances the simulation in fixed frames until the coin rests (or frames run out). */
function settle(coin: CoinPhysics, startMs: number, frameMs = 16, maxFrames = 4000): number {
  let now = startMs
  for (let i = 0; i < maxFrames && coin.mode !== 'resting'; i += 1) {
    now += frameMs
    coin.step(now)
  }
  return now
}

describe('faceAt', () => {
  it('maps even half-turns to analog and odd half-turns to digital', () => {
    expect([faceAt(0), faceAt(180), faceAt(360), faceAt(-180), faceAt(540)]).toEqual(['analog', 'digital', 'analog', 'digital', 'digital'])
  })

  it('maps an angle to its nearest resting face', () => {
    expect(faceAt(100)).toBe('digital')
  })
})

describe('drag', () => {
  it('rotates 1:1 with the pointer using the configured degrees-per-pixel', () => {
    const coin = createCoinPhysics({ degreesPerPixel: 0.5 })
    coin.grab(100, 0)
    coin.drag(300, 16)
    expect(coin.angle).toBe(100)
  })

  it('catches a spinning coin dead when grabbed', () => {
    const coin = createCoinPhysics()
    coin.tap(0)
    coin.step(100)
    const caughtAt = coin.angle
    coin.grab(0, 100)
    coin.step(500)
    expect(coin.angle).toBe(caughtAt)
  })
})

describe('momentum and friction', () => {
  it('decays speed after release so each interval travels less than the last', () => {
    const coin = createCoinPhysics({ friction: 0.002 })
    coin.grab(0, 0)
    coin.drag(400, 100)
    coin.release(100)
    const a1 = coin.step(200)
    const a2 = coin.step(300)
    const a3 = coin.step(400)
    expect([a3 - a2 > 0, a2 - a1 > a3 - a2]).toEqual([true, true])
  })

  it('settles onto a face and reports it', () => {
    const onSettle = vi.fn<SettleHandler>()
    const coin = createCoinPhysics({ onSettle })
    coin.grab(0, 0)
    coin.drag(120, 100)
    coin.release(100)
    settle(coin, 100)
    expect(onSettle).toHaveBeenCalledWith(faceAt(coin.angle))
  })

  it('rests exactly on a multiple of 180 degrees', () => {
    const coin = createCoinPhysics()
    coin.grab(0, 0)
    coin.drag(500, 120)
    coin.release(120)
    settle(coin, 120)
    expect(coin.angle % 180).toBe(0)
  })

  it('biases the landing face toward the throw direction', () => {
    const coin = createCoinPhysics({ friction: 0.002 })
    coin.grab(0, 0)
    // how: 90° of drag in 50 ms — halfway between faces, but momentum carries forward.
    coin.drag(Math.round(90 / 0.55), 50)
    coin.release(50)
    settle(coin, 50)
    expect(coin.angle).toBeGreaterThanOrEqual(180)
  })
})

describe('tap', () => {
  it('flips exactly one face forward from rest', () => {
    const onSettle = vi.fn<SettleHandler>()
    const coin = createCoinPhysics({ onSettle })
    coin.tap(0)
    settle(coin, 0)
    expect({ angle: coin.angle, face: onSettle.mock.calls[0]?.[0] }).toEqual({ angle: 180, face: 'digital' })
  })

  it('flips one face per tap across consecutive taps', () => {
    const coin = createCoinPhysics()
    let now = 0
    for (let i = 0; i < 3; i += 1) {
      coin.tap(now)
      now = settle(coin, now)
    }
    expect(coin.angle).toBe(540)
  })
})

describe('flipTo', () => {
  it('travels to the requested face', () => {
    const onSettle = vi.fn<SettleHandler>()
    const coin = createCoinPhysics({ onSettle })
    coin.flipTo('digital', 0)
    settle(coin, 0)
    expect(onSettle).toHaveBeenCalledWith('digital')
  })

  it('does nothing when resting on the requested face', () => {
    const coin = createCoinPhysics()
    coin.flipTo('analog', 0)
    coin.step(1000)
    expect(coin.mode).toBe('resting')
  })

  it('reports the target face while settling', () => {
    const coin = createCoinPhysics()
    coin.flipTo('digital', 0)
    coin.step(16)
    expect(coin.face).toBe('digital')
  })
})

describe('slow release', () => {
  it('springs back to the nearest face without momentum', () => {
    const coin = createCoinPhysics()
    coin.grab(0, 0)
    coin.drag(20, 1000)
    coin.release(1000)
    settle(coin, 1000)
    expect(coin.angle).toBe(0)
  })
})
