import type { ConfigType } from './patterns'
import { CONFIG_PATTERNS, getConfigPatternsByType } from './patterns'

describe('CONFIG_PATTERNS', () => {
  it('contains package.json pattern', () => {
    expect(CONFIG_PATTERNS['package.json']).toBeDefined()
    expect(CONFIG_PATTERNS['package.json'].patterns).toContain('package.json')
  })

  it('contains tsconfig pattern with wildcard', () => {
    expect(CONFIG_PATTERNS.tsconfig).toBeDefined()
    expect(CONFIG_PATTERNS.tsconfig.patterns).toContain('tsconfig.json')
    expect(CONFIG_PATTERNS.tsconfig.patterns).toContain('tsconfig.*.json')
  })

  it('categorizes configs by format', () => {
    expect(CONFIG_PATTERNS['package.json'].format).toBe('json')
    expect(CONFIG_PATTERNS.tsconfig.format).toBe('jsonc')
    expect(CONFIG_PATTERNS.webpack.format).toBe('js')
    expect(CONFIG_PATTERNS['pnpm-lock.yaml'].format).toBe('yaml')
  })

  it('marks sensitive configs', () => {
    expect(CONFIG_PATTERNS['.npmrc'].sensitive).toBe(true)
    expect(CONFIG_PATTERNS.env.sensitive).toBe(true)
  })

  it('marks extendable configs', () => {
    expect(CONFIG_PATTERNS.tsconfig.canExtend).toBe(true)
  })
})

describe('getConfigPatternsByType', () => {
  it('returns patterns for single type', () => {
    const patterns = getConfigPatternsByType(['package.json'])

    expect(patterns).toContain('package.json')
  })

  it('returns patterns for multiple types', () => {
    const patterns = getConfigPatternsByType(['package.json', 'tsconfig'])

    expect(patterns).toContain('package.json')
    expect(patterns).toContain('tsconfig.json')
    expect(patterns).toContain('tsconfig.*.json')
  })

  it('returns empty array for unknown type', () => {
    const patterns = getConfigPatternsByType(<ConfigType[]>(<unknown>['unknown']))

    expect(patterns).toEqual([])
  })
})
