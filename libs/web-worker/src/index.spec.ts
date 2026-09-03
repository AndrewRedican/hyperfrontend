import { describe, expect, it } from '@hyperfrontend/testing'
import { noop } from './index'

describe('web-worker', () => {
  it('exports noop', () => {
    expect(noop).toBeDefined()
    expect(noop()).toBeUndefined()
  })
})
