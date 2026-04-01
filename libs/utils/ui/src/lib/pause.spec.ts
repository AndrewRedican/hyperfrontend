import { pause } from './pause'

describe('pause', () => {
  let setTimeoutSpy: jest.SpyInstance

  beforeEach(() => {
    setTimeoutSpy = jest.spyOn(global, 'setTimeout')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('waits for the specified duration when given a positive timeMS value', async () => {
    const timeMS = 500

    const pausePromise = pause(timeMS)
    jest.runAllTimers()

    await pausePromise

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1)
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), timeMS)
  })

  it('does not wait when given a zero timeMS value', async () => {
    const timeMS = 0

    const pausePromise = pause(timeMS)
    jest.runAllTimers()

    await pausePromise

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1)
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), timeMS)
  })

  it('does not wait when given a negative timeMS value', async () => {
    const timeMS = -500

    const pausePromise = pause(timeMS)
    jest.runAllTimers()

    await pausePromise

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1)
    expect(setTimeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), timeMS)
  })

  afterEach(() => {
    jest.clearAllMocks()
    setTimeoutSpy.mockRestore()
  })
})
