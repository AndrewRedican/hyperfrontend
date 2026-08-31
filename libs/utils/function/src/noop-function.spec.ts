import { describe, expect, it } from '@hyperfrontend/testing'
import { noop } from './noop-function'

describe('noop', () => {
  it('does not throw an error regardless of the arguments', () => {
    expect(() => noop()).not.toThrow()
    expect(() => noop(1, 'a', true, {}, [], () => void 0)).not.toThrow()
  })
})
