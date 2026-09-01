import { describe, expect, it } from '@hyperfrontend/testing'
import { topicId } from '../creators/mocks'
import { isValidTopicId } from './is-valid-topic-id'

describe('isValidTopicId', () => {
  it('returns true for valid topicId', () => {
    expect(isValidTopicId(topicId)).toBe(true)
  })

  it('returns false for invalid topicId', () => {
    expect(isValidTopicId(null)).toBe(false)
    expect(isValidTopicId(void 0)).toBe(false)
    expect(isValidTopicId(5)).toBe(false)
    expect(isValidTopicId({})).toBe(false)
    expect(isValidTopicId('')).toBe(false)
    expect(isValidTopicId('not-a-guid')).toBe(false)
  })
})
