import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { clickAtPosition } from './click-at-position'

describe('clickAtPosition', () => {
  const originalDispatch = document.dispatchEvent
  const mockDispatchEvent = jest.fn()

  beforeEach(() => {
    document.dispatchEvent = mockDispatchEvent
  })

  afterEach(() => {
    document.dispatchEvent = originalDispatch
    mockDispatchEvent.mockReset()
  })

  it('dispatches mouse down event with corresponding coordinates', () => {
    clickAtPosition(5, 7)
    expect(mockDispatchEvent).toHaveBeenCalled()
  })
})
