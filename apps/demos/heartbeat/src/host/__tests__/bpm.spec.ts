import { describe, expect, it } from 'vitest'
import { createRollingBpm } from '../bpm'

describe('createRollingBpm', () => {
  it('reports the steady rate from even intervals', () => {
    const rolling = createRollingBpm()
    for (const at of [1000, 2000, 3000, 4000]) {
      rolling.addBeat(at)
    }
    expect(rolling.bpmAt(4000)).toBe(60)
  })

  it('returns null before two beats arrive', () => {
    const rolling = createRollingBpm()
    rolling.addBeat(1000)
    expect(rolling.bpmAt(1000)).toBeNull()
  })

  it('a user extra beat bumps the rate above steady', () => {
    const rolling = createRollingBpm()
    for (const at of [1000, 2000, 2400, 3000]) {
      rolling.addBeat(at)
    }
    expect(rolling.bpmAt(3000)).toBe(90)
  })

  it('prunes beats that fall out of the window', () => {
    const rolling = createRollingBpm(5000)
    for (const at of [0, 1000, 10000, 11000]) {
      rolling.addBeat(at)
    }
    expect(rolling.bpmAt(11000)).toBe(60)
  })

  it('returns null once every beat is stale', () => {
    const rolling = createRollingBpm(5000)
    rolling.addBeat(0)
    rolling.addBeat(1000)
    expect(rolling.bpmAt(20000)).toBeNull()
  })

  it('returns null for coincident timestamps', () => {
    const rolling = createRollingBpm()
    rolling.addBeat(1000)
    rolling.addBeat(1000)
    expect(rolling.bpmAt(1000)).toBeNull()
  })

  it('reset clears the window', () => {
    const rolling = createRollingBpm()
    rolling.addBeat(1000)
    rolling.addBeat(2000)
    rolling.reset()
    expect(rolling.bpmAt(2000)).toBeNull()
  })
})
