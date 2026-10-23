import { describe, expect, it } from '@hyperfrontend/testing'
import { lacksPrefix, samePath, unquotePath } from './paths'

describe('unquotePath', () => {
  it('drops double quotes around a segment', () => {
    expect(unquotePath('a."b-c".d')).toBe('a.b-c.d')
  })

  it('drops single quotes around a segment', () => {
    expect(unquotePath("a.'0'")).toBe('a.0')
  })

  it('keeps a quote left open', () => {
    expect(unquotePath('a."b')).toBe('a."b')
  })
})

describe('samePath', () => {
  it('compares paths with their segment quotes dropped', () => {
    expect(samePath('a."0"', 'a.0')).toBe(true)
  })

  it('tells different paths apart', () => {
    expect(samePath('a.b', 'a.c')).toBe(false)
  })
})

describe('lacksPrefix', () => {
  it('finds a prefix written with quotes', () => {
    expect(lacksPrefix('a.0.b', 'a."0"')).toBe(false)
  })

  it('reports a path without the prefix', () => {
    expect(lacksPrefix('a.b', 'c')).toBe(true)
  })
})
