import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'

describe('fake timers', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('advances a cascade step by step, then drains what the cascade scheduled', () => {
    const order: string[] = []
    setTimeout(() => {
      order.push('first')
      setTimeout(() => {
        order.push('second')
        setTimeout(() => order.push('third'), 30)
      }, 20)
    }, 10)

    jest.advanceTimersByTime(10)
    expect(order).toEqual(['first'])

    jest.advanceTimersByTime(20)
    expect(order).toEqual(['first', 'second'])

    jest.runAllTimers()
    expect(order).toEqual(['first', 'second', 'third'])
  })

  it('moves the clock with setSystemTime', () => {
    jest.setSystemTime(new Date('2026-01-02T03:04:05.000Z'))
    expect(new Date().toISOString()).toBe('2026-01-02T03:04:05.000Z')
    expect(Date.now()).toBe(Date.parse('2026-01-02T03:04:05.000Z'))
  })
})
