import type { Callback } from './call-stack.model'
import { callStack } from './call-stack'

describe('callStack', () => {
  it('creates a new callStack with correct initial size', () => {
    const stack = callStack()
    expect(stack.size).toBe(0)
  })

  it('adds callbacks and returns unsubscribe function', () => {
    const stack = callStack()
    const cb1 = jest.fn()
    const cb2 = jest.fn()

    const unsubscribe = stack.add(cb1, cb2)
    expect(stack.size).toBe(2)

    unsubscribe()
    expect(stack.size).toBe(0)
  })

  it('throws an error if a non-function is added', () => {
    const stack = callStack()
    expect(() => stack.add('notAFunction' as unknown as Callback)).toThrow('Cannot add items that are not functions.')
  })

  it('calls the callbacks with the specified arguments', () => {
    const stack = callStack()
    const cb1 = jest.fn()
    const cb2 = jest.fn()

    stack.add(cb1, cb2)
    stack.call(false, 1, 'two', { three: 3 })

    expect(cb1).toHaveBeenCalledWith(1, 'two', { three: 3 })
    expect(cb2).toHaveBeenCalledWith(1, 'two', { three: 3 })
  })

  it('removes callbacks after calling them if remove is true', () => {
    const stack = callStack()
    const cb1 = jest.fn()
    const cb2 = jest.fn()

    stack.add(cb1, cb2)
    stack.call(true, 1, 'two', { three: 3 })

    expect(stack.size).toBe(0)
  })

  it('does not remove callbacks after calling them if remove is false', () => {
    const stack = callStack()
    const cb1 = jest.fn()
    const cb2 = jest.fn()

    stack.add(cb1, cb2)
    stack.call(false, 1, 'two', { three: 3 })

    expect(stack.size).toBe(2)
  })

  it('clears the callStack when calling clear', () => {
    const stack = callStack()
    const cb1 = jest.fn()
    const cb2 = jest.fn()

    stack.add(cb1, cb2)
    stack.clear()

    expect(stack.size).toBe(0)
  })
})
