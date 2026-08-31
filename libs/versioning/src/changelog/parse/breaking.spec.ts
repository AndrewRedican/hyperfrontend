import { describe, expect, it } from '@hyperfrontend/testing'
import { parseBreakingFromItem } from './breaking'

describe('parseBreakingFromItem', () => {
  it('lifts the bold marker off the text', () => {
    expect(parseBreakingFromItem('**BREAKING** drop the sync open')).toEqual({ breaking: true, text: 'drop the sync open' })
  })

  it('lifts a bold marker with the colon inside', () => {
    expect(parseBreakingFromItem('**BREAKING:** drop the sync open')).toEqual({ breaking: true, text: 'drop the sync open' })
  })

  it('lifts a bold marker with the colon outside', () => {
    expect(parseBreakingFromItem('**BREAKING**: drop the sync open')).toEqual({ breaking: true, text: 'drop the sync open' })
  })

  it('lifts a bracketed marker', () => {
    expect(parseBreakingFromItem('[BREAKING] drop the sync open')).toEqual({ breaking: true, text: 'drop the sync open' })
  })

  it('lifts a bracketed marker with a trailing colon', () => {
    expect(parseBreakingFromItem('[BREAKING]: drop the sync open')).toEqual({ breaking: true, text: 'drop the sync open' })
  })

  it('lifts a warning-sign marker', () => {
    expect(parseBreakingFromItem('⚠️ BREAKING: drop the sync open')).toEqual({ breaking: true, text: 'drop the sync open' })
  })

  it('lifts a warning sign written without its variation selector', () => {
    expect(parseBreakingFromItem('⚠ BREAKING: drop the sync open')).toEqual({ breaking: true, text: 'drop the sync open' })
  })

  it('lifts a warning sign written without a following space', () => {
    expect(parseBreakingFromItem('⚠️BREAKING: drop the sync open')).toEqual({ breaking: true, text: 'drop the sync open' })
  })

  it('lifts a marker that runs straight into the description', () => {
    expect(parseBreakingFromItem('**BREAKING:**drop the sync open')).toEqual({ breaking: true, text: 'drop the sync open' })
  })

  it('lifts a marker that is the whole item', () => {
    expect(parseBreakingFromItem('**BREAKING**')).toEqual({ breaking: true, text: '' })
  })

  it('lifts a bare marker', () => {
    expect(parseBreakingFromItem('BREAKING: drop the sync open')).toEqual({ breaking: true, text: 'drop the sync open' })
  })

  it('lifts the BREAKING CHANGE spelling', () => {
    expect(parseBreakingFromItem('BREAKING CHANGE: drop the sync open')).toEqual({ breaking: true, text: 'drop the sync open' })
  })

  it('lifts the BREAKING CHANGES spelling', () => {
    expect(parseBreakingFromItem('**BREAKING CHANGES:** drop the sync open')).toEqual({ breaking: true, text: 'drop the sync open' })
  })

  it('matches the marker case-insensitively', () => {
    expect(parseBreakingFromItem('**breaking:** drop the sync open')).toEqual({ breaking: true, text: 'drop the sync open' })
  })

  it('collapses a run of markers left by earlier round trips', () => {
    expect(parseBreakingFromItem('**BREAKING** **BREAKING:** **BREAKING:** ⚠️ BREAKING: drop the sync open')).toEqual({
      breaking: true,
      text: 'drop the sync open',
    })
  })

  it('leaves an unmarked item alone', () => {
    expect(parseBreakingFromItem('add a retry budget')).toEqual({ breaking: false, text: 'add a retry budget' })
  })

  it('leaves prose that merely opens with the word alone', () => {
    expect(parseBreakingFromItem('Breaking apart the parser')).toEqual({ breaking: false, text: 'Breaking apart the parser' })
  })

  it('leaves a scope prefix alone', () => {
    expect(parseBreakingFromItem('**api:** add an endpoint')).toEqual({ breaking: false, text: '**api:** add an endpoint' })
  })

  it('leaves an unterminated bold marker alone', () => {
    expect(parseBreakingFromItem('**BREAKING drop the sync open')).toEqual({ breaking: false, text: '**BREAKING drop the sync open' })
  })

  it('leaves a longer word that merely starts with the marker alone', () => {
    expect(parseBreakingFromItem('**BREAKINGS** drop the sync open')).toEqual({
      breaking: false,
      text: '**BREAKINGS** drop the sync open',
    })
  })

  it('leaves text shorter than the marker alone', () => {
    expect(parseBreakingFromItem('BRE')).toEqual({ breaking: false, text: 'BRE' })
  })

  it('trims surrounding whitespace', () => {
    expect(parseBreakingFromItem('  **BREAKING** drop the sync open  ')).toEqual({ breaking: true, text: 'drop the sync open' })
  })
})
