import { describe, expect, it } from '@hyperfrontend/testing'
import { topic } from '../creators/mocks'
import { isValidTopic } from './is-valid-topic'

describe('isValidTopic', () => {
  it('returns true for a valid topic', () => {
    expect(isValidTopic(topic)).toBe(true)
  })

  it.each([void 0, null, 45, {}, { name: 'name' }, { id: 'id' }])('returns false for %p, which is not a topic', (value) => {
    expect(isValidTopic(value)).toBe(false)
  })
})
