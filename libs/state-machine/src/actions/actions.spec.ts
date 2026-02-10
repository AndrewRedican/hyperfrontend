import * as actions from './actions'
import * as types from './actions.types'

describe('actions', () => {
  it('verifies action types are defined', () => {
    expect(types.START).toBeDefined()
    expect(types.CANCEL).toBeDefined()
    expect(types.PAUSE).toBeDefined()
    expect(types.SUCCESS).toBeDefined()
    expect(types.FAIL).toBeDefined()
  })

  it('start', () => {
    const result = actions.start('arg1')
    expect(result).toEqual({ type: types.START, payload: 'arg1' })
  })

  it('start without arguments', () => {
    const result = actions.start()
    expect(result).toEqual({ type: types.START, payload: undefined })
  })

  it('start with object payload', () => {
    const payload = { id: 1, name: 'test' }
    const result = actions.start(payload)
    expect(result).toEqual({ type: types.START, payload })
  })

  it('cancel', () => {
    const result = actions.cancel('arg1')
    expect(result).toEqual({ type: types.CANCEL, payload: 'arg1' })
  })

  it('cancel without arguments', () => {
    const result = actions.cancel()
    expect(result).toEqual({ type: types.CANCEL, payload: undefined })
  })

  it('cancel with object payload', () => {
    const payload = { reason: 'user requested' }
    const result = actions.cancel(payload)
    expect(result).toEqual({ type: types.CANCEL, payload })
  })

  it('pause', () => {
    const result = actions.pause('arg1')
    expect(result).toEqual({ type: types.PAUSE, payload: 'arg1' })
  })

  it('pause without arguments', () => {
    const result = actions.pause()
    expect(result).toEqual({ type: types.PAUSE, payload: undefined })
  })

  it('pause with object payload', () => {
    const payload = { resumeAt: Date.now() }
    const result = actions.pause(payload)
    expect(result).toEqual({ type: types.PAUSE, payload })
  })

  it('success', () => {
    const result = actions.success('arg1')
    expect(result).toEqual({ type: types.SUCCESS, payload: 'arg1' })
  })

  it('success without arguments', () => {
    const result = actions.success()
    expect(result).toEqual({ type: types.SUCCESS, payload: undefined })
  })

  it('success with object payload', () => {
    const payload = { data: { id: 1 }, timestamp: Date.now() }
    const result = actions.success(payload)
    expect(result).toEqual({ type: types.SUCCESS, payload })
  })

  it('fail with string error', () => {
    const result = actions.fail('error message')
    expect(result).toEqual({ type: types.FAIL, error: 'error message' })
  })

  it('fail with Error object', () => {
    const error = new Error('Something went wrong')
    const result = actions.fail(error)
    expect(result).toEqual({ type: types.FAIL, error })
  })

  it('fail without arguments', () => {
    const result = actions.fail()
    expect(result).toEqual({ type: types.FAIL, error: undefined })
  })
})
