import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
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

  it('reports healthy on start and gone on stop', () => {
    const states: string[] = []
    const monitor = createHeartbeatMonitor(jest.fn(), (status) => states.push(status.state))
    monitor.start()
    monitor.stop()
    expect(states).toEqual(['healthy', 'gone'])
  })

  it('reports gone only once when stopped twice', () => {
    const states: string[] = []
    const monitor = createHeartbeatMonitor(jest.fn(), (status) => states.push(status.state))
    monitor.start()
    monitor.stop()
    monitor.stop()
    expect(states).toEqual(['healthy', 'gone'])
  })

  it('pauses the miss count while unobservable', () => {
    const onUnresponsive = jest.fn()
    const monitor = createHeartbeatMonitor(onUnresponsive)
    monitor.start()
    monitor.setObservable(false)
    jest.advanceTimersByTime(10_000)
    expect(onUnresponsive).not.toHaveBeenCalled()
  })

  it('grants a fresh miss budget when watching resumes', () => {
    const onUnresponsive = jest.fn()
    const monitor = createHeartbeatMonitor(onUnresponsive)
    monitor.start()
    jest.advanceTimersByTime(2000)
    monitor.setObservable(false)
    monitor.setObservable(true)
    jest.advanceTimersByTime(2000)
    expect(onUnresponsive).not.toHaveBeenCalled()
  })

  it('fires unresponsive once the fresh budget granted on return runs out', () => {
    const onUnresponsive = jest.fn()
    const monitor = createHeartbeatMonitor(onUnresponsive)
    monitor.start()
    jest.advanceTimersByTime(2000)
    monitor.setObservable(false)
    monitor.setObservable(true)
    jest.advanceTimersByTime(2000)
    jest.advanceTimersByTime(1000)
    expect(onUnresponsive).toHaveBeenCalledTimes(1)
  })

  it('reports unobservable while hidden and suspect once the fresh budget runs out', () => {
    const states: string[] = []
    const monitor = createHeartbeatMonitor(jest.fn(), (status) => states.push(status.state))
    monitor.start()
    jest.advanceTimersByTime(2000)
    monitor.setObservable(false)
    monitor.setObservable(true)
    jest.advanceTimersByTime(2000)
    jest.advanceTimersByTime(1000)
    expect(states).toEqual(['healthy', 'unobservable', 'suspect'])
  })

  it('stays unobservable after watching resumes until a beat proves the feature is there', () => {
    const states: string[] = []
    const monitor = createHeartbeatMonitor(jest.fn(), (status) => states.push(status.state))
    monitor.start()
    monitor.setObservable(false)
    monitor.setObservable(true)
    jest.advanceTimersByTime(2000)
    const beforeBeat = [...states]
    monitor.beat()
    expect({ beforeBeat, afterBeat: states }).toEqual({
      beforeBeat: ['healthy', 'unobservable'],
      afterBeat: ['healthy', 'unobservable', 'healthy'],
    })
  })

  it('never calls a hidden feature healthy on a beat, because silence there is not evidence either', () => {
    const states: string[] = []
    const monitor = createHeartbeatMonitor(jest.fn(), (status) => states.push(status.state))
    monitor.start()
    monitor.setObservable(false)
    monitor.beat()
    expect(states).toEqual(['healthy', 'unobservable'])
  })

  it('declares a feature that went quiet while hidden suspect rather than healthy on return', () => {
    const states: string[] = []
    const monitor = createHeartbeatMonitor(jest.fn(), (status) => states.push(status.state))
    monitor.start()
    monitor.beat()
    monitor.setObservable(false)
    jest.advanceTimersByTime(60_000)
    monitor.setObservable(true)
    jest.advanceTimersByTime(3000)
    expect(states).toEqual(['healthy', 'unobservable', 'suspect'])
  })

  it('fires unresponsive once for a feature that went quiet while hidden', () => {
    const onUnresponsive = jest.fn()
    const monitor = createHeartbeatMonitor(onUnresponsive)
    monitor.start()
    monitor.beat()
    monitor.setObservable(false)
    jest.advanceTimersByTime(60_000)
    monitor.setObservable(true)
    jest.advanceTimersByTime(3000)
    expect(onUnresponsive).toHaveBeenCalledTimes(1)
  })

  it('starts as unobservable when hidden before start', () => {
    const states: string[] = []
    const monitor = createHeartbeatMonitor(jest.fn(), (status) => states.push(status.state))
    monitor.setObservable(false)
    monitor.start()
    expect(states).toEqual(['unobservable'])
  })

  it('recovers to healthy when a beat ends a suspect episode', () => {
    const monitor = createHeartbeatMonitor(jest.fn())
    monitor.start()
    jest.advanceTimersByTime(3000)
    monitor.beat()
    expect(monitor.getStatus().state).toBe('healthy')
  })

  it('re-arms the callback when a beat ends a suspect episode', () => {
    const onUnresponsive = jest.fn()
    const monitor = createHeartbeatMonitor(onUnresponsive)
    monitor.start()
    jest.advanceTimersByTime(3000)
    const callsAfterFirstEpisode = onUnresponsive.mock.calls.length
    monitor.beat()
    jest.advanceTimersByTime(3000)
    expect({ callsAfterFirstEpisode, callsAfterSecondEpisode: onUnresponsive.mock.calls.length }).toEqual({
      callsAfterFirstEpisode: 1,
      callsAfterSecondEpisode: 2,
    })
  })

  it('reports each suspect episode and the recovery between them', () => {
    const states: string[] = []
    const monitor = createHeartbeatMonitor(jest.fn(), (status) => states.push(status.state))
    monitor.start()
    jest.advanceTimersByTime(3000)
    monitor.beat()
    jest.advanceTimersByTime(3000)
    expect(states).toEqual(['healthy', 'suspect', 'healthy', 'suspect'])
  })

  it('recovers to unobservable when the suspect-ending beat arrives while hidden', () => {
    const onUnresponsive = jest.fn()
    const monitor = createHeartbeatMonitor(onUnresponsive)
    monitor.start()
    jest.advanceTimersByTime(3000)
    monitor.setObservable(false)
    monitor.beat()
    expect(monitor.getStatus().state).toBe('unobservable')
  })

  it('ignores redundant observability updates', () => {
    const states: string[] = []
    const monitor = createHeartbeatMonitor(jest.fn(), (status) => states.push(status.state))
    monitor.start()
    monitor.setObservable(true)
    monitor.setObservable(false)
    monitor.setObservable(false)
    expect(states).toEqual(['healthy', 'unobservable'])
  })

  it('records a beat before start without a state transition', () => {
    const states: string[] = []
    const monitor = createHeartbeatMonitor(jest.fn(), (status) => states.push(status.state))
    monitor.beat()
    expect({ states, lastBeatAt: monitor.getStatus().lastBeatAt }).toEqual({ states: [], lastBeatAt: expect.any(Number) })
  })

  it('exposes the miss count and last beat in the status snapshot', () => {
    const monitor = createHeartbeatMonitor(jest.fn())
    monitor.start()
    monitor.beat()
    jest.advanceTimersByTime(2000)
    expect(monitor.getStatus()).toEqual(expect.objectContaining({ missedBeats: 2, lastBeatAt: expect.any(Number) }))
  })
})
