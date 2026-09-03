import { describe, expect, it } from '@hyperfrontend/testing'
import { USAGE } from './usage'

describe('USAGE', () => {
  it('documents the three commands under the hf bin', () => {
    expect(USAGE).toEqual(expect.stringContaining('Usage: hf <command>'))
  })
})
