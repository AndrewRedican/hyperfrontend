import { describe, expect, it } from '@hyperfrontend/testing'
import { createBreakingFromSubject, createBreakingFromFooter, createNonBreaking, isBreakingFooterKey } from './breaking'

describe('createBreakingFromSubject', () => {
  it('creates breaking from subject', () => {
    expect(createBreakingFromSubject('API changed')).toEqual({ isBreaking: true, source: 'subject', description: 'API changed' })
  })

  it('creates breaking from subject without description', () => {
    expect(createBreakingFromSubject()).toEqual({ isBreaking: true, source: 'subject', description: undefined })
  })
})

describe('createBreakingFromFooter', () => {
  it('creates breaking from footer', () => {
    expect(createBreakingFromFooter('API changed')).toEqual({ isBreaking: true, source: 'footer', description: 'API changed' })
  })
})

describe('createNonBreaking', () => {
  it('creates non-breaking', () => {
    expect(createNonBreaking()).toEqual({ isBreaking: false, source: 'none', description: undefined })
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
    const keys = ['breaking change', 'breaking-change']
    expect(keys.map((key) => [key, isBreakingFooterKey(key)])).toEqual(keys.map((key) => [key, true]))
  })

  it('returns false for non-breaking keys', () => {
    const keys = ['Other', 'Refs', 'Fixes']
    expect(keys.map((key) => [key, isBreakingFooterKey(key)])).toEqual(keys.map((key) => [key, false]))
  })
})
