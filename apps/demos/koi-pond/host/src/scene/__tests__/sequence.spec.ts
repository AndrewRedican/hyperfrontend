import type { KoiInstanceId } from '../instance-id'
import { describe, expect, it } from 'vitest'
import { SEQUENCE_DEADLINE_MS, createSequenceTracker } from '../sequence'

/** The three koi every fixture here disturbs. */
const SHOAL: KoiInstanceId[] = ['vanilla:0', 'react:0', 'lit:0']

describe('before a strike', () => {
  it('is not running', () => {
    expect(createSequenceTracker().isRunning).toBe(false)
  })

  it('ignores a koi settling on its own', () => {
    expect(createSequenceTracker().settle('lit:0', 1000)).toBeNull()
  })

  it('has no deadline to expire', () => {
    expect(createSequenceTracker().expire(9_000_000)).toBeNull()
  })
})

describe('a running sequence', () => {
  it('is running once the water is struck', () => {
    const sequence = createSequenceTracker()
    sequence.begin(SHOAL, 0)
    expect(sequence.isRunning).toBe(true)
  })

  it('stays open while koi are still fleeing', () => {
    const sequence = createSequenceTracker()
    sequence.begin(SHOAL, 0)
    expect(sequence.settle('lit:0', 500)).toBeNull()
  })

  it('completes when the last koi settles', () => {
    const sequence = createSequenceTracker()
    sequence.begin(SHOAL, 0)
    sequence.settle('lit:0', 500)
    sequence.settle('react:0', 900)
    expect(sequence.settle('vanilla:0', 1400)).toBe(3)
  })

  it('closes itself once it has completed', () => {
    const sequence = createSequenceTracker()
    sequence.begin(SHOAL, 0)
    SHOAL.forEach((id, index) => sequence.settle(id, 500 + index))
    expect(sequence.isRunning).toBe(false)
  })

  it('completes only once for one strike', () => {
    const sequence = createSequenceTracker()
    sequence.begin(SHOAL, 0)
    SHOAL.forEach((id, index) => sequence.settle(id, 500 + index))
    expect(sequence.settle('lit:0', 2000)).toBeNull()
  })

  it('ignores a koi settling twice', () => {
    const sequence = createSequenceTracker()
    sequence.begin(SHOAL, 0)
    sequence.settle('lit:0', 100)
    expect(sequence.settle('lit:0', 200)).toBeNull()
  })

  it('completes immediately when a lone koi settles', () => {
    const sequence = createSequenceTracker()
    sequence.begin(['vanilla:0'], 0)
    expect(sequence.settle('vanilla:0', 300)).toBe(1)
  })
})

describe('a second strike', () => {
  it('restarts the sequence rather than nesting inside the first', () => {
    const sequence = createSequenceTracker()
    sequence.begin(SHOAL, 0)
    sequence.settle('lit:0', 200)
    sequence.begin(SHOAL, 400)
    expect(sequence.settle('lit:0', 600)).toBeNull()
  })
})

describe('a koi that never answers', () => {
  it('holds the sequence open until the deadline', () => {
    const sequence = createSequenceTracker()
    sequence.begin(SHOAL, 0)
    expect(sequence.expire(SEQUENCE_DEADLINE_MS - 1)).toBeNull()
  })

  it('closes the sequence once the deadline passes', () => {
    const sequence = createSequenceTracker()
    sequence.begin(SHOAL, 0)
    expect(sequence.expire(SEQUENCE_DEADLINE_MS)).toBe(3)
  })

  it('completes a late settle rather than leaving it hanging', () => {
    const sequence = createSequenceTracker()
    sequence.begin(SHOAL, 0)
    sequence.settle('lit:0', 100)
    expect(sequence.settle('react:0', SEQUENCE_DEADLINE_MS)).toBe(3)
  })

  it('expires only once', () => {
    const sequence = createSequenceTracker()
    sequence.begin(SHOAL, 0)
    sequence.expire(SEQUENCE_DEADLINE_MS)
    expect(sequence.expire(SEQUENCE_DEADLINE_MS * 2)).toBeNull()
  })
})
