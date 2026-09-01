import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { after as afterAll, before as beforeAll, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { detectConfigs, findConfigFile, getConfigPaths, clearConfigDetectionCache } from './detect'

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')
const MONOREPO = resolve(FIXTURES_DIR, 'monorepo')
const TEST_DIR = join(import.meta.dirname, '__test_fixtures_detect__')

describe('detectConfigs', () => {
  it('detects package.json in project', () => {
    const configs = detectConfigs(MINIMAL_PROJECT)

    expect(configs.some((c) => c.type === 'package.json')).toBe(true)
  })

  it('detects tsconfig.json in project', () => {
    const configs = detectConfigs(MINIMAL_PROJECT)

    expect(configs.some((c) => c.type === 'tsconfig')).toBe(true)
  })

  it('detects nx.json in monorepo', () => {
    const configs = detectConfigs(MONOREPO)

    expect(configs.some((c) => c.type === 'nx')).toBe(true)
  })

  it('detects project.json in nested directories', () => {
    const configs = detectConfigs(MONOREPO, undefined, { maxDepth: 10 })

    expect(configs.some((c) => c.type === 'project.json')).toBe(true)
  })

  it('filters by specific types', () => {
    const configs = detectConfigs(MINIMAL_PROJECT, ['package.json'])

    expect(configs.every((c) => c.type === 'package.json')).toBe(true)
    expect(configs.length).toBe(1)
  })

  it('returns config info with pattern details', () => {
    const configs = detectConfigs(MINIMAL_PROJECT, ['package.json'])

    expect(configs[0].info).toBeDefined()
    expect(configs[0].info.format).toBe('json')
    expect(configs[0].matchedPattern).toBe('package.json')
  })
})

describe('findConfigFile', () => {
  it('finds package.json in project', () => {
    const result = findConfigFile(MINIMAL_PROJECT, 'package.json')

    expect(result).toContain('package.json')
    expect(result).toContain(MINIMAL_PROJECT)
  })

  it('finds tsconfig.json in project', () => {
    const result = findConfigFile(MINIMAL_PROJECT, 'tsconfig')

    expect(result).toContain('tsconfig.json')
  })

  it('returns null for missing config', () => {
    const result = findConfigFile(MINIMAL_PROJECT, 'nx')

    expect(result).toBeNull()
  })

  it('finds nx.json in monorepo', () => {
    const result = findConfigFile(MONOREPO, 'nx')

    expect(result).toContain('nx.json')
  })
})

describe('getConfigPaths', () => {
  it('returns patterns for package.json type', () => {
    const paths = getConfigPaths('package.json')

    expect(paths).toContain('package.json')
  })

  it('returns multiple patterns for tsconfig type', () => {
    const paths = getConfigPaths('tsconfig')

    expect(paths).toContain('tsconfig.json')
    expect(paths).toContain('tsconfig.*.json')
  })

  it('returns empty array for unknown type', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const paths = getConfigPaths('unknown' as any)

    expect(paths).toEqual([])
  })
})

describe('detectConfigs - caching', () => {
  beforeEach(() => {
    clearConfigDetectionCache()
  })

  it('returns cached results on subsequent calls', () => {
    const result1 = detectConfigs(MINIMAL_PROJECT)

    const result2 = detectConfigs(MINIMAL_PROJECT)

    expect(result1).toEqual(result2)
  })

  it('skips cache when skipCache option is true', () => {
    const result1 = detectConfigs(MINIMAL_PROJECT)

    const result2 = detectConfigs(MINIMAL_PROJECT, undefined, { skipCache: true })

    expect(result1.length).toBe(result2.length)
  })

  it('uses different cache keys for different types', () => {
    const allConfigs = detectConfigs(MINIMAL_PROJECT)
    const tsConfigs = detectConfigs(MINIMAL_PROJECT, ['tsconfig'])

    expect(allConfigs.length).toBeGreaterThan(tsConfigs.length)
  })

  it('uses different cache keys for different options', () => {
    const result1 = detectConfigs(MINIMAL_PROJECT, undefined, { maxDepth: 1 })
    const result2 = detectConfigs(MINIMAL_PROJECT, undefined, { maxDepth: 10 })

    expect(result1).toBeDefined()
    expect(result2).toBeDefined()
  })
})

describe('detectConfigs - edge cases', () => {
  beforeAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('handles empty directory', () => {
    const configs = detectConfigs(TEST_DIR)

    expect(configs).toEqual([])
  })

  it('detects exact config file match', () => {
    mkdirSync(join(TEST_DIR, 'exact-test'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'exact-test', 'tsconfig.json'), '{}')

    const configs = detectConfigs(join(TEST_DIR, 'exact-test'), ['tsconfig'], { skipCache: true })

    expect(configs.length).toBeGreaterThan(0)
    expect(configs.some((c) => c.path === 'tsconfig.json')).toBe(true)
  })

  it('detects eslint flat config', () => {
    mkdirSync(join(TEST_DIR, 'eslint-test'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'eslint-test', 'eslint.config.js'), 'module.exports = []')

    const configs = detectConfigs(join(TEST_DIR, 'eslint-test'), ['eslint'])

    expect(configs.some((c) => c.path === 'eslint.config.js')).toBe(true)
  })

  it('detects nested config files with recursive pattern', () => {
    mkdirSync(join(TEST_DIR, 'nested-config', 'packages', 'lib'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'nested-config', 'packages', 'lib', 'project.json'), '{}')

    const configs = detectConfigs(join(TEST_DIR, 'nested-config'), ['project.json'], { maxDepth: 10, skipCache: true })

    expect(configs.length).toBeGreaterThan(0)
    expect(configs.some((c) => c.path.includes('project.json'))).toBe(true)
  })

  it('does not duplicate configs when patterns match same file', () => {
    mkdirSync(join(TEST_DIR, 'no-dup-test'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'no-dup-test', 'package.json'), '{}')

    const configs = detectConfigs(join(TEST_DIR, 'no-dup-test'), ['package.json'])

    const packageJsonConfigs = configs.filter((c) => c.type === 'package.json')
    expect(packageJsonConfigs.length).toBe(1)
  })

  it('handles unknown config type gracefully', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configs = detectConfigs(MINIMAL_PROJECT, ['unknown-type' as any])

    expect(configs).toEqual([])
  })

  it('respects includeHidden option', () => {
    mkdirSync(join(TEST_DIR, 'hidden-test', '.hidden-dir'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'hidden-test', '.hidden-dir', 'tsconfig.json'), '{}')

    const withHidden = detectConfigs(join(TEST_DIR, 'hidden-test'), ['tsconfig'], {
      includeHidden: true,
      maxDepth: 10,
    })

    const withoutHidden = detectConfigs(join(TEST_DIR, 'hidden-test'), ['tsconfig'], {
      includeHidden: false,
      maxDepth: 10,
      skipCache: true,
    })

    expect(withHidden.length).toBeGreaterThanOrEqual(withoutHidden.length)
  })
})

describe('findConfigFile - edge cases', () => {
  beforeAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('returns null for unknown config type', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = findConfigFile(MINIMAL_PROJECT, 'unknown' as any)

    expect(result).toBeNull()
  })

  it('finds config using exact pattern first', () => {
    mkdirSync(join(TEST_DIR, 'exact-pattern'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'exact-pattern', 'package.json'), '{}')

    const result = findConfigFile(join(TEST_DIR, 'exact-pattern'), 'package.json')

    expect(result).toContain('package.json')
  })

  it('finds config using glob pattern', () => {
    mkdirSync(join(TEST_DIR, 'glob-pattern'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'glob-pattern', 'eslint.config.cjs'), 'module.exports = []')

    const result = findConfigFile(join(TEST_DIR, 'glob-pattern'), 'eslint')

    expect(result).toContain('eslint.config.cjs')
  })

  it('returns null when config file does not exist', () => {
    mkdirSync(join(TEST_DIR, 'no-config'), { recursive: true })

    const result = findConfigFile(join(TEST_DIR, 'no-config'), 'tsconfig')

    expect(result).toBeNull()
  })
})
