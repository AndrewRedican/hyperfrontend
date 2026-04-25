import { formatHeader } from './format-header'

describe('formatHeader', () => {
  it('renders type and subject only', () => {
    expect(formatHeader({ type: 'feat', subject: 'add login' })).toBe('feat: add login')
  })

  it('renders a single scope', () => {
    expect(formatHeader({ type: 'feat', scope: ['core'], subject: 'add login' })).toBe('feat(core): add login')
  })

  it('joins multi-scope with a comma', () => {
    expect(formatHeader({ type: 'feat', scope: ['versioning', 'questions'], subject: 'add x' })).toBe('feat(versioning,questions): add x')
  })

  it('places the breaking marker after the scope', () => {
    expect(formatHeader({ type: 'feat', scope: ['core'], subject: 'drop thing', breaking: true })).toBe('feat(core)!: drop thing')
  })

  it('places the breaking marker directly after the type when no scope is set', () => {
    expect(formatHeader({ type: 'fix', subject: 'oops', breaking: true })).toBe('fix!: oops')
  })

  it('treats an empty scope array the same as no scope', () => {
    expect(formatHeader({ type: 'feat', scope: [], subject: 'x' })).toBe('feat: x')
  })

  it('renders partial drafts without throwing', () => {
    expect(formatHeader({ type: 'fix' })).toBe('fix: ')
  })

  it('renders a completely empty draft', () => {
    expect(formatHeader({})).toBe(': ')
  })
})
