import { describe, expect, it } from '@hyperfrontend/testing'
import { createBreakingFromSubject, createBreakingFromFooter, createNonBreaking, isBreakingFooterKey } from './breaking'

describe('createBreakingFromSubject', () => {
  it('creates breaking from subject', () => {
    const breaking = createBreakingFromSubject('API changed')
    expect(breaking.isBreaking).toBe(true)
    expect(breaking.source).toBe('subject')
    expect(breaking.description).toBe('API changed')
  })

  it('creates breaking from subject without description', () => {
    const breaking = createBreakingFromSubject()
    expect(breaking.isBreaking).toBe(true)
    expect(breaking.source).toBe('subject')
    expect(breaking.description).toBeUndefined()
  })
})

describe('createBreakingFromFooter', () => {
  it('creates breaking from footer', () => {
    const breaking = createBreakingFromFooter('API changed')
    expect(breaking.isBreaking).toBe(true)
    expect(breaking.source).toBe('footer')
    expect(breaking.description).toBe('API changed')
  })
})

describe('createNonBreaking', () => {
  it('creates non-breaking', () => {
    const nonBreaking = createNonBreaking()
    expect(nonBreaking.isBreaking).toBe(false)
    expect(nonBreaking.source).toBe('none')
    expect(nonBreaking.description).toBeUndefined()
  })
})

describe('isBreakingFooterKey', () => {
  it('detects BREAKING CHANGE', () => {
    expect(isBreakingFooterKey('BREAKING CHANGE')).toBe(true)
  })

  it('detects BREAKING-CHANGE', () => {
    expect(isBreakingFooterKey('BREAKING-CHANGE')).toBe(true)
  })

  it('handles lowercase', () => {
    expect(isBreakingFooterKey('breaking change')).toBe(true)
    expect(isBreakingFooterKey('breaking-change')).toBe(true)
  })

  it('returns false for non-breaking keys', () => {
    expect(isBreakingFooterKey('Other')).toBe(false)
    expect(isBreakingFooterKey('Refs')).toBe(false)
    expect(isBreakingFooterKey('Fixes')).toBe(false)
  })
})
