import type { RuleFile } from '../../../engine/rule'
import { describe, expect, it } from '@hyperfrontend/testing'
import { lineMap } from '../../../text/lines'
import { atLeast, caret, createClassOf, fragmentOf, pragmaOf, reactVersion } from './settings'

/**
 * A file holding the comments given.
 *
 * @param comments - The inner texts of its comments
 * @returns A file with no text but those comments
 */
function fileWith(comments: readonly string[]): RuleFile {
  return {
    path: '/root/file.tsx',
    root: '/root',
    relativePath: 'file.tsx',
    text: '',
    lines: lineMap(''),
    comments: comments.map((text) => ({ start: 0, end: 0, text })),
  }
}

describe('reactVersion', () => {
  it('assumes the newest version without settings', () => {
    expect(reactVersion({})).toEqual([999, 999, 999])
  })
  it('assumes the newest version for detect', () => {
    expect(reactVersion({ react: { version: 'detect' } })).toEqual([999, 999, 999])
  })
  it('pads a major and minor version', () => {
    expect(reactVersion({ react: { version: '19.0' } })).toEqual([19, 0, 0])
  })
  it('reads a full version', () => {
    expect(reactVersion({ react: { version: '0.14.10' } })).toEqual([0, 14, 10])
  })
  it('skips a prefix and stops at a suffix', () => {
    expect(reactVersion({ react: { version: 'v16.3.0-beta.2' } })).toEqual([16, 3, 0])
  })
  it('stops at a dot followed by no digit', () => {
    expect(reactVersion({ react: { version: '16.x' } })).toEqual([16, 0, 0])
  })
  it('stops at a trailing dot', () => {
    expect(reactVersion({ react: { version: '17.' } })).toEqual([17, 0, 0])
  })
  it('reads a number', () => {
    expect(reactVersion({ react: { version: 15 } })).toEqual([15, 0, 0])
  })
})

describe('atLeast', () => {
  it('accepts a newer version', () => {
    expect(atLeast([16, 0, 0], [15, 0, 0])).toBe(true)
  })
  it('rejects an older patch', () => {
    expect(atLeast([15, 0, 0], [15, 0, 1])).toBe(false)
  })
})

describe('caret', () => {
  it('accepts the same major', () => {
    expect(caret([15, 9, 0], [15, 7, 0])).toBe(true)
  })
  it('rejects the next major', () => {
    expect(caret([16, 0, 0], [15, 7, 0])).toBe(false)
  })
  it('rejects an older version', () => {
    expect(caret([15, 6, 0], [15, 7, 0])).toBe(false)
  })
  it('holds a zero major to its minor', () => {
    expect(caret([0, 14, 3], [0, 14, 0])).toBe(true)
  })
  it('rejects the next minor of a zero major', () => {
    expect(caret([0, 15, 0], [0, 14, 0])).toBe(false)
  })
  it('holds a zero minor to its patch', () => {
    expect(caret([0, 0, 1], [0, 0, 1])).toBe(true)
  })
  it('rejects the next patch of a zero minor', () => {
    expect(caret([0, 0, 2], [0, 0, 1])).toBe(false)
  })
})

describe('pragmaOf', () => {
  it('reads an annotation up to its dot', () => {
    expect(pragmaOf(fileWith([' plain ', '* @jsx Preact.h ']), { react: { pragma: 'Other' } })).toBe('Preact')
  })
  it('falls back to the setting', () => {
    expect(pragmaOf(fileWith([]), { react: { pragma: 'Other' } })).toBe('Other')
  })
  it('falls back to React', () => {
    expect(pragmaOf(fileWith([]), {})).toBe('React')
  })
})

describe('createClassOf', () => {
  it('reads the setting', () => {
    expect(createClassOf({ react: { createClass: 'make' } })).toBe('make')
  })
  it('falls back to createReactClass', () => {
    expect(createClassOf({})).toBe('createReactClass')
  })
})

describe('fragmentOf', () => {
  it('reads the setting', () => {
    expect(fragmentOf({ react: { fragment: 'Frag' } })).toBe('Frag')
  })
  it('falls back to Fragment', () => {
    expect(fragmentOf({})).toBe('Fragment')
  })
})
