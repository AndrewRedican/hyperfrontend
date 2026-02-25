import { start, cancel, pause, success, fail } from './actions'
import { START, CANCEL, PAUSE, SUCCESS, FAIL } from './actions.types'

describe('actions', () => {
  it('verifies action types are defined', () => {
    expect(START).toBeDefined()
    expect(CANCEL).toBeDefined()
    expect(PAUSE).toBeDefined()
    expect(SUCCESS).toBeDefined()
    expect(FAIL).toBeDefined()
  })

  it('start', () => {
    const result = start('arg1')
    expect(result).toEqual({ type: START, payload: 'arg1' })
  })

  it('start without arguments', () => {
    const result = start()
    expect(result).toEqual({ type: START, payload: undefined })
  })

  it('start with object payload', () => {
    const payload = { id: 1, name: 'test' }
    const result = start(payload)
    expect(result).toEqual({ type: START, payload })
  })

  it('cancel', () => {
    const result = cancel('arg1')
    expect(result).toEqual({ type: CANCEL, payload: 'arg1' })
  })

  it('cancel without arguments', () => {
    const result = cancel()
    expect(result).toEqual({ type: CANCEL, payload: undefined })
  })

  it('cancel with object payload', () => {
    const payload = { reason: 'user requested' }
    const result = cancel(payload)
    expect(result).toEqual({ type: CANCEL, payload })
  })

  it('pause', () => {
    const result = pause('arg1')
    expect(result).toEqual({ type: PAUSE, payload: 'arg1' })
  })

  it('pause without arguments', () => {
    const result = pause()
    expect(result).toEqual({ type: PAUSE, payload: undefined })
  })

  it('pause with object payload', () => {
    const payload = { resumeAt: Date.now() }
    const result = pause(payload)
    expect(result).toEqual({ type: PAUSE, payload })
  })

  it('success', () => {
    const result = success('arg1')
    expect(result).toEqual({ type: SUCCESS, payload: 'arg1' })
  })

  it('success without arguments', () => {
    const result = success()
    expect(result).toEqual({ type: SUCCESS, payload: undefined })
  })

  it('success with object payload', () => {
    const payload = { data: { id: 1 }, timestamp: Date.now() }
    const result = success(payload)
    expect(result).toEqual({ type: SUCCESS, payload })
  })

  it('fail with string error', () => {
    const result = fail('error message')
    expect(result).toEqual({ type: FAIL, error: 'error message' })
  })

  it('fail with Error object', () => {
    const error = new Error('Something went wrong')
    const result = fail(error)
    expect(result).toEqual({ type: FAIL, error })
  })

  it('fail without arguments', () => {
    const result = fail()
    expect(result).toEqual({ type: FAIL, error: undefined })
  })
})
