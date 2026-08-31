import type { Timer } from './create-timer'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createTimer } from './create-timer'
import { sleep } from './sleep'

describe('createTimer', () => {
  let callback: jest.Func
  let timer: Timer

  beforeEach(() => {
    callback = jest.fn()
    timer = createTimer(callback, 200)
  })

  it('correctly calls the callback after the specified delay', async () => {
    timer.resume()
    await sleep(100)
    expect(callback).not.toHaveBeenCalled()
    await sleep(150)
    expect(callback).toHaveBeenCalled()
  })

  it('pauses and does not call the callback if not resumed in time', async () => {
    timer.resume()
    await sleep(100)
    timer.pause()
    await sleep(150)
    expect(callback).not.toHaveBeenCalled()
  })

  it('resets and calls the callback after the new delay', async () => {
    timer.resume()
    await sleep(100)
    timer.reset(300)
    await sleep(250)
    expect(callback).not.toHaveBeenCalled()
    await sleep(100)
    expect(callback).toHaveBeenCalled()
  })

  it('resets and calls the callback after the same delay', async () => {
    timer.resume()
    await sleep(100)
    timer.reset()
    await sleep(100)
    expect(callback).not.toHaveBeenCalled()
    await sleep(150)
    expect(callback).toHaveBeenCalled()
  })

  it('does nothing when pause is called while already paused', async () => {
    timer.pause()
    timer.pause()
    expect(callback).not.toHaveBeenCalled()
  })

  it('does nothing when resume is called while already running', async () => {
    timer.resume()
    timer.resume()
    await sleep(250)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('correctly tracks remaining time when paused and resumed', async () => {
    timer.resume()
    await sleep(100)
    timer.pause()
    await sleep(200)
    timer.resume()
    await sleep(150)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('can pause immediately after resume before any time elapses', () => {
    timer.resume()
    timer.pause()
    expect(callback).not.toHaveBeenCalled()
  })
})
