import { describe, expect, it } from '@hyperfrontend/testing'
import { greet } from './greeting'

describe('greeting', () => {
  it('sees the replacement the setup module declared, without declaring anything itself', () => {
    expect(greet()).toBe('from-setup')
  })
})
