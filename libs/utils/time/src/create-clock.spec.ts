import type { Clock } from './create-clock'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createClock } from './create-clock'
import { sleep } from './sleep'

describe('createClock', () => {
  let callback: jest.Func
  let clock: Clock

  beforeEach(() => {
    callback = jest.fn()
    clock = createClock(100)
  })

  it('notifies subscribers with the current time', async () => {
    clock.subscribe(callback)

    clock.start()
    await sleep(350)
    clock.stop()

    expect(callback).toHaveBeenCalledTimes(3)
    expect(callback).toHaveBeenCalledWith(expect.any(Date))
  })

  it('stops notifying subscribers after being stopped', async () => {
    clock.start()
    clock.subscribe(callback)

    await sleep(350)
    clock.stop()
    await sleep(200)

    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('stops invoking callback after unsubscribing', async () => {
    clock = createClock()
    clock.subscribe(callback)
    clock.start()

    await sleep(clock.interval + 100)
    clock.unsubscribe(callback)

    await sleep(clock.interval + 100)
    clock.stop()

    expect(callback).toHaveBeenCalled()
  })

  it('does not start a new interval when already started', async () => {
    clock.subscribe(callback)
    clock.start()
    clock.start()

    await sleep(350)
    clock.stop()

    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('does nothing when stop is called while already stopped', async () => {
    clock.subscribe(callback)
    clock.stop()

    expect(callback).not.toHaveBeenCalled()
  })

  it('can be stopped and restarted multiple times', async () => {
    clock.subscribe(callback)

    clock.start()
    await sleep(150)
    clock.stop()

    clock.start()
    await sleep(150)
    clock.stop()

    expect(callback).toHaveBeenCalledTimes(2)
  })
})
