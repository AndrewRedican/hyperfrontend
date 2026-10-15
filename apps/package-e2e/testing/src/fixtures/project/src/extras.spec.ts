import { describe, expect, it } from '@hyperfrontend/testing'
import { twice } from './extras'

describe('extras', () => {
  it('doubles', () => {
    expect(twice(4)).toBe(8)
  })
})
