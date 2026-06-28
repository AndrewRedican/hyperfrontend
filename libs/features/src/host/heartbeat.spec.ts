import { createHeartbeatMonitor } from './heartbeat'

jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/timers', () => ({
  setInterval: (callback: () => void, delay: number) => setInterval(callback, delay),
  clearInterval: (id: number) => clearInterval(id),
}))

describe('createHeartbeatMonitor', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('fires unresponsive after the miss threshold', () => {
    const onUnresponsive = jest.fn()
    createHeartbeatMonitor(onUnresponsive).start()
    jest.advanceTimersByTime(3000)
    expect(onUnresponsive).toHaveBeenCalledTimes(1)
  })

  it('reports the missed-beat count and a null timestamp when no beat arrived', () => {
    const onUnresponsive = jest.fn()
    createHeartbeatMonitor(onUnresponsive).start()
    jest.advanceTimersByTime(3000)
    expect(onUnresponsive).toHaveBeenCalledWith(3, null)
  })

  it('stays responsive while beats keep arriving', () => {
    const onUnresponsive = jest.fn()
    const monitor = createHeartbeatMonitor(onUnresponsive)
    monitor.start()
    jest.advanceTimersByTime(2000)
    monitor.beat()
    jest.advanceTimersByTime(2000)
    expect(onUnresponsive).not.toHaveBeenCalled()
  })

  it('passes the last beat timestamp when it goes unresponsive', () => {
    const onUnresponsive = jest.fn()
    const monitor = createHeartbeatMonitor(onUnresponsive)
    monitor.start()
    monitor.beat()
    jest.advanceTimersByTime(3000)
    expect(onUnresponsive).toHaveBeenCalledWith(3, expect.any(Number))
  })

  it('fires only once at the threshold', () => {
    const onUnresponsive = jest.fn()
    createHeartbeatMonitor(onUnresponsive).start()
    jest.advanceTimersByTime(6000)
    expect(onUnresponsive).toHaveBeenCalledTimes(1)
  })

  it('does not start a second watchdog when already running', () => {
    const onUnresponsive = jest.fn()
    const monitor = createHeartbeatMonitor(onUnresponsive)
    monitor.start()
    monitor.start()
    jest.advanceTimersByTime(3000)
    expect(onUnresponsive).toHaveBeenCalledTimes(1)
  })

  it('stops watching after stop', () => {
    const onUnresponsive = jest.fn()
    const monitor = createHeartbeatMonitor(onUnresponsive)
    monitor.start()
    monitor.stop()
    jest.advanceTimersByTime(5000)
    expect(onUnresponsive).not.toHaveBeenCalled()
  })
})
