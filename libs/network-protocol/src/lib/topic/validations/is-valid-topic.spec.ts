import { isValidTopic } from './is-valid-topic'
import { topic } from '../creators/mocks'

describe('isValidTopic', () => {
  it('returns true for a valid topic', () => {
    expect(isValidTopic(topic)).toBe(true)
  })

  it('returns false for anything other than a topic', () => {
    expect(isValidTopic(void 0)).toBe(false)
    expect(isValidTopic(null)).toBe(false)
    expect(isValidTopic(45)).toBe(false)
    expect(isValidTopic({})).toBe(false)
    expect(isValidTopic({ name: 'name' })).toBe(false)
    expect(isValidTopic({ id: 'id' })).toBe(false)
  })
})
