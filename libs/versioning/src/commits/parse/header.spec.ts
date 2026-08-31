import { describe, expect, it } from '@hyperfrontend/testing'
import { parseHeader } from './header'

describe('parseHeader', () => {
  it('parses simple header', () => {
    const result = parseHeader('feat: add new feature')

    expect(result.type).toBe('feat')
    expect(result.subject).toBe('add new feature')
    expect(result.scope).toEqual([])
    expect(result.breaking).toBe(false)
  })

  it('parses header with scope', () => {
    const result = parseHeader('feat(api): add new endpoint')

    expect(result.type).toBe('feat')
    expect(result.scope).toEqual(['api'])
    expect(result.subject).toBe('add new endpoint')
  })

  it('parses header with breaking indicator', () => {
    const result = parseHeader('feat(api)!: remove deprecated endpoint')

    expect(result.type).toBe('feat')
    expect(result.scope).toEqual(['api'])
    expect(result.subject).toBe('remove deprecated endpoint')
    expect(result.breaking).toBe(true)
  })

  it('parses breaking without scope', () => {
    const result = parseHeader('feat!: breaking change')

    expect(result.type).toBe('feat')
    expect(result.scope).toEqual([])
    expect(result.breaking).toBe(true)
  })

  it('parses comma-separated multi-scope header', () => {
    const result = parseHeader('feat(versioning,questions): add searchable select')

    expect(result.type).toBe('feat')
    expect(result.scope).toEqual(['versioning', 'questions'])
    expect(result.subject).toBe('add searchable select')
    expect(result.breaking).toBe(false)
  })

  it('trims whitespace from comma-separated scopes', () => {
    const result = parseHeader('fix(a, b , c): x')
    expect(result.scope).toEqual(['a', 'b', 'c'])
  })

  it('parses multi-scope breaking header', () => {
    const result = parseHeader('feat(a,b)!: breaking multi')
    expect(result.scope).toEqual(['a', 'b'])
    expect(result.breaking).toBe(true)
    expect(result.subject).toBe('breaking multi')
  })

  it('handles all standard types', () => {
    const types = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert']

    for (const type of types) {
      const result = parseHeader(`${type}: test message`)
      expect(result.type).toBe(type)
    }
  })

  it('lowercases type', () => {
    const result = parseHeader('FEAT: uppercase type')
    expect(result.type).toBe('feat')
  })

  it('handles empty message', () => {
    const result = parseHeader('')
    expect(result.type).toBe('')
    expect(result.subject).toBe('')
    expect(result.scope).toEqual([])
  })

  it('handles type only', () => {
    const result = parseHeader('feat')
    expect(result.type).toBe('feat')
    expect(result.subject).toBe('')
    expect(result.scope).toEqual([])
  })

  it('handles type with colon only', () => {
    const result = parseHeader('feat:')
    expect(result.type).toBe('feat')
    expect(result.subject).toBe('')
    expect(result.scope).toEqual([])
  })

  it('trims whitespace from subject', () => {
    const result = parseHeader('feat:   extra spaces  ')
    expect(result.subject).toBe('extra spaces')
  })

  it('preserves case in subject', () => {
    const result = parseHeader('feat: Add NEW Feature')
    expect(result.subject).toBe('Add NEW Feature')
  })

  it('handles scope with special characters', () => {
    const result = parseHeader('feat(api-v2): add endpoint')
    expect(result.scope).toEqual(['api-v2'])
  })

  it('handles missing closing parenthesis', () => {
    const result = parseHeader('feat(api: subject')
    expect(result.type).toBe('feat')
    expect(result.scope).toEqual(['api: subject'])
    expect(result.subject).toBe('')
  })

  it('handles empty scope parens as a single empty-string entry', () => {
    const result = parseHeader('feat(): empty scope')
    expect(result.type).toBe('feat')
    expect(result.scope).toEqual([''])
    expect(result.subject).toBe('empty scope')
  })

  it('handles numeric type characters', () => {
    const result = parseHeader('feat123: test')
    expect(result.type).toBe('feat123')
  })
})
