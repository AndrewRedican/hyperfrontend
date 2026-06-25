import { ControlType } from '../shared/control'
import { createHeartbeatEmitter } from './heartbeat'

jest.mock('@hyperfrontend/immutable-api-utils/built-in-copy/timers', () => ({
  setInterval: (callback: () => void, delay: number) => setInterval(callback, delay),
  clearInterval: (id: number) => clearInterval(id),
}))

describe('createHeartbeatEmitter', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('sends a beat on each interval', () => {
    const send = jest.fn()
    createHeartbeatEmitter(send).start()
    jest.advanceTimersByTime(3000)
    expect(send).toHaveBeenCalledTimes(3)
  })

  it('sends the reserved beat type', () => {
    const send = jest.fn()
    createHeartbeatEmitter(send).start()
    jest.advanceTimersByTime(1000)
    expect(send).toHaveBeenCalledWith(ControlType.Beat)
  })

  it('does not start a second interval when already running', () => {
    const send = jest.fn()
    const heartbeat = createHeartbeatEmitter(send)
    heartbeat.start()
    heartbeat.start()
    jest.advanceTimersByTime(1000)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('stops sending beats after stop', () => {
    const send = jest.fn()
    const heartbeat = createHeartbeatEmitter(send)
    heartbeat.start()
    heartbeat.stop()
    jest.advanceTimersByTime(5000)
    expect(send).not.toHaveBeenCalled()
  })
})
