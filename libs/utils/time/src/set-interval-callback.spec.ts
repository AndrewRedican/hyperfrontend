import { setIntervalCallback } from './set-interval-callback'
import { sleep } from './sleep'

describe('setIntervalCallback', () => {
  it('repeatedly calls the callback at specified intervals', async () => {
    const callback = jest.fn()
    const stopInterval = setIntervalCallback(callback, 100)
    await sleep(350)
    stopInterval()
    expect(callback).toHaveBeenCalledTimes(3)
    await sleep(200)
    expect(callback).toHaveBeenCalledTimes(3)
  })
})
