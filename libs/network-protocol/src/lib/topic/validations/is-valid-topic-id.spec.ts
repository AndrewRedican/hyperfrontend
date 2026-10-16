import { describe, expect, it } from '@hyperfrontend/testing'
import { topicId } from '../creators/mocks'
import { isValidTopicId } from './is-valid-topic-id'

describe('isValidTopicId', () => {
  it('returns true for valid topicId', () => {
    expect(isValidTopicId(topicId)).toBe(true)
  })

  it.each([null, void 0, 5, {}, '', 'not-a-guid'])('returns false for the invalid topicId %p', (value) => {
    expect(isValidTopicId(value)).toBe(false)
  })
})
