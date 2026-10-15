import { describe, expect, it } from '@hyperfrontend/testing'
import { parseHeader } from './header'

describe('parseHeader', () => {
  it('parses simple header', () => {
    const result = parseHeader('feat: add new feature')

    expect(result).toEqual({ type: 'feat', subject: 'add new feature', scope: [], breaking: false })
  })

  it('parses header with scope', () => {
    const result = parseHeader('feat(api): add new endpoint')

    expect(result).toEqual({ type: 'feat', scope: ['api'], subject: 'add new endpoint', breaking: false })
  })

  it('parses header with breaking indicator', () => {
    const result = parseHeader('feat(api)!: remove deprecated endpoint')

    expect(result).toEqual({ type: 'feat', scope: ['api'], subject: 'remove deprecated endpoint', breaking: true })
  })

  it('parses breaking without scope', () => {
    const result = parseHeader('feat!: breaking change')

    expect(result).toEqual({ type: 'feat', scope: [], subject: 'breaking change', breaking: true })
  })

  it('parses comma-separated multi-scope header', () => {
    const result = parseHeader('feat(versioning,questions): add searchable select')

    expect(result).toEqual({ type: 'feat', scope: ['versioning', 'questions'], subject: 'add searchable select', breaking: false })
  })

  it('trims whitespace from comma-separated scopes', () => {
    const result = parseHeader('fix(a, b , c): x')
    expect(result.scope).toEqual(['a', 'b', 'c'])
  })

  it('parses multi-scope breaking header', () => {
    const result = parseHeader('feat(a,b)!: breaking multi')
    expect(result).toEqual({ type: 'feat', scope: ['a', 'b'], subject: 'breaking multi', breaking: true })
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
    expect(result).toEqual({ type: '', subject: '', scope: [], breaking: false })
  })

  it('handles type only', () => {
    const result = parseHeader('feat')
    expect(result).toEqual({ type: 'feat', subject: '', scope: [], breaking: false })
  })

  it('handles type with colon only', () => {
    const result = parseHeader('feat:')
    expect(result).toEqual({ type: 'feat', subject: '', scope: [], breaking: false })
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
    expect(result).toEqual({ type: 'feat', scope: ['api: subject'], subject: '', breaking: false })
  })

  it('handles empty scope parens as a single empty-string entry', () => {
    const result = parseHeader('feat(): empty scope')
    expect(result).toEqual({ type: 'feat', scope: [''], subject: 'empty scope', breaking: false })
  })

  it('handles numeric type characters', () => {
    const result = parseHeader('feat123: test')
    expect(result.type).toBe('feat123')
  })
})
