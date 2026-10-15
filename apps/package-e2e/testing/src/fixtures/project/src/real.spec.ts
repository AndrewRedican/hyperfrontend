import { describe, expect, it } from '@hyperfrontend/testing'
import { source } from './real'

describe('moduleNameMapper', () => {
  it('sees the module the mapper redirected to', () => {
    expect(source()).toBe('stubbed')
  })
})
