import type { ConfigType } from './patterns'
import { describe, expect, it } from '@hyperfrontend/testing'
import { CONFIG_PATTERNS, getConfigPatternsByType } from './patterns'

describe('CONFIG_PATTERNS', () => {
  it('contains package.json pattern', () => {
    expect(CONFIG_PATTERNS['package.json'].patterns).toContain('package.json')
  })

  it('contains tsconfig pattern with wildcard', () => {
    expect(CONFIG_PATTERNS.tsconfig.patterns).toEqual(expect.arrayContaining(['tsconfig.json', 'tsconfig.*.json']))
  })

  it('categorizes configs by format', () => {
    expect({
      packageJson: CONFIG_PATTERNS['package.json'].format,
      tsconfig: CONFIG_PATTERNS.tsconfig.format,
      webpack: CONFIG_PATTERNS.webpack.format,
      pnpmLock: CONFIG_PATTERNS['pnpm-lock.yaml'].format,
    }).toEqual({ packageJson: 'json', tsconfig: 'jsonc', webpack: 'js', pnpmLock: 'yaml' })
  })

  it('marks sensitive configs', () => {
    expect({ npmrc: CONFIG_PATTERNS['.npmrc'].sensitive, env: CONFIG_PATTERNS.env.sensitive }).toEqual({ npmrc: true, env: true })
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

    expect(patterns).toEqual(expect.arrayContaining(['package.json', 'tsconfig.json', 'tsconfig.*.json']))
  })

  it('returns empty array for unknown type', () => {
    const patterns = getConfigPatternsByType(['unknown'] as unknown as ConfigType[])

    expect(patterns).toEqual([])
  })
})
