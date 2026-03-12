import { parseHeader } from './header'

describe('parseHeader', () => {
  it('parses simple header', () => {
    const result = parseHeader('feat: add new feature')

    expect(result.type).toBe('feat')
    expect(result.subject).toBe('add new feature')
    expect(result.scope).toBeUndefined()
    expect(result.breaking).toBe(false)
  })

  it('parses header with scope', () => {
    const result = parseHeader('feat(api): add new endpoint')

    expect(result.type).toBe('feat')
    expect(result.scope).toBe('api')
    expect(result.subject).toBe('add new endpoint')
  })

  it('parses header with breaking indicator', () => {
    const result = parseHeader('feat(api)!: remove deprecated endpoint')

    expect(result.type).toBe('feat')
    expect(result.scope).toBe('api')
    expect(result.subject).toBe('remove deprecated endpoint')
    expect(result.breaking).toBe(true)
  })

  it('parses breaking without scope', () => {
    const result = parseHeader('feat!: breaking change')

    expect(result.type).toBe('feat')
    expect(result.scope).toBeUndefined()
    expect(result.breaking).toBe(true)
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
  })

  it('handles type only', () => {
    const result = parseHeader('feat')
    expect(result.type).toBe('feat')
    expect(result.subject).toBe('')
  })

  it('handles type with colon only', () => {
    const result = parseHeader('feat:')
    expect(result.type).toBe('feat')
    expect(result.subject).toBe('')
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
    expect(result.scope).toBe('api-v2')
  })

  it('handles missing closing parenthesis', () => {
    const result = parseHeader('feat(api: subject')
    expect(result.type).toBe('feat')
    expect(result.scope).toBe('api: subject')
    expect(result.subject).toBe('')
  })

  it('handles empty scope', () => {
    const result = parseHeader('feat(): empty scope')
    expect(result.type).toBe('feat')
    expect(result.scope).toBe('')
    expect(result.subject).toBe('empty scope')
  })

  it('handles numeric type characters', () => {
    const result = parseHeader('feat123: test')
    expect(result.type).toBe('feat123')
  })
})
