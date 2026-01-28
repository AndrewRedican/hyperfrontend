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
    const result = actions.start('arg1', 'arg2')
    expect(result).toEqual({ type: types.START, 0: 'arg1', 1: 'arg2' })
  })

  it('start without arguments', () => {
    const result = actions.start()
    expect(result).toEqual({ type: types.START })
  })

  it('start with single argument', () => {
    const result = actions.start('arg1')
    expect(result).toEqual({ type: types.START, 0: 'arg1' })
  })

  it('cancel', () => {
    const result = actions.cancel('arg1', 'arg2')
    expect(result).toEqual({ type: types.CANCEL, 0: 'arg1', 1: 'arg2' })
  })

  it('cancel without arguments', () => {
    const result = actions.cancel()
    expect(result).toEqual({ type: types.CANCEL })
  })

  it('cancel with single argument', () => {
    const result = actions.cancel('arg1')
    expect(result).toEqual({ type: types.CANCEL, 0: 'arg1' })
  })

  it('pause', () => {
    const result = actions.pause('arg1', 'arg2')
    expect(result).toEqual({ type: types.PAUSE, 0: 'arg1', 1: 'arg2' })
  })

  it('pause without arguments', () => {
    const result = actions.pause()
    expect(result).toEqual({ type: types.PAUSE })
  })

  it('pause with single argument', () => {
    const result = actions.pause('arg1')
    expect(result).toEqual({ type: types.PAUSE, 0: 'arg1' })
  })

  it('success', () => {
    const result = actions.success('arg1', 'arg2')
    expect(result).toEqual({ type: types.SUCCESS, 0: 'arg1', 1: 'arg2' })
  })

  it('success without arguments', () => {
    const result = actions.success()
    expect(result).toEqual({ type: types.SUCCESS })
  })

  it('success with single argument', () => {
    const result = actions.success('arg1')
    expect(result).toEqual({ type: types.SUCCESS, 0: 'arg1' })
  })

  it('fail', () => {
    const result = actions.fail('arg1', 'arg2')
    expect(result).toEqual({ type: types.FAIL, 0: 'arg1', 1: 'arg2' })
  })

  it('fail without arguments', () => {
    const result = actions.fail()
    expect(result).toEqual({ type: types.FAIL })
  })

  it('fail with single argument', () => {
    const result = actions.fail('arg1')
    expect(result).toEqual({ type: types.FAIL, 0: 'arg1' })
  })
})
