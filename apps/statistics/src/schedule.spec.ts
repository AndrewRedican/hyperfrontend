import { dateNow } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { describe, expect, it } from '@hyperfrontend/testing'
import { pause, runOnSchedule } from './schedule'

describe('pause', () => {
  it('waits about as long as it is asked to', async () => {
    const started = dateNow()
    await pause(30, new AbortController().signal)
    expect(dateNow() - started).toBeGreaterThanOrEqual(25)
  })

  it('returns at once when the signal has already aborted', async () => {
    const started = dateNow()
    await pause(60_000, AbortSignal.abort())
    expect(dateNow() - started).toBeLessThan(1000)
  })

  it('is cut short when the signal aborts during the wait', async () => {
    const controller = new AbortController()
    const started = dateNow()
    const waiting = pause(60_000, controller.signal)
    controller.abort()
    await waiting
    expect(dateNow() - started).toBeLessThan(1000)
  })
})

describe('runOnSchedule', () => {
  it('runs the task again after every interval until it is asked to stop', async () => {
    const controller = new AbortController()
    let turns = 0
    await runOnSchedule({
      everyMs: 1,
      signal: controller.signal,
      task: async () => {
        turns += 1
        if (turns === 3) controller.abort()
      },
    })
    expect(turns).toBe(3)
  })

  it('runs nothing when it is asked to stop before it starts', async () => {
    let turns = 0
    await runOnSchedule({
      everyMs: 1,
      signal: AbortSignal.abort(),
      task: async () => {
        turns += 1
      },
    })
    expect(turns).toBe(0)
  })

  it('ends without waiting out the interval when it is asked to stop between turns', async () => {
    const controller = new AbortController()
    const started = dateNow()
    const schedule = runOnSchedule({ everyMs: 60_000, signal: controller.signal, task: async () => undefined })
    controller.abort()
    await schedule
    expect(dateNow() - started).toBeLessThan(1000)
  })
})
