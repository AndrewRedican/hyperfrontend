import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { readPackageJson, readPackageJsonIfExists, findNearestPackageJson } from './read'

const FIXTURES_DIR = resolve(__dirname, '../../../__fixtures__')
const TEST_DIR = join(__dirname, '__test_fixtures_read__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')
const MONOREPO = resolve(FIXTURES_DIR, 'monorepo')

describe('readPackageJson', () => {
  it('reads package.json from directory', () => {
    const pkg = readPackageJson(MINIMAL_PROJECT)

    expect(pkg.name).toBe('minimal-test-project')
    expect(pkg.version).toBe('1.0.0')
  })

  it('reads package.json from direct path', () => {
    const pkg = readPackageJson(resolve(MINIMAL_PROJECT, 'package.json'))

    expect(pkg.name).toBe('minimal-test-project')
  })

  it('parses dependencies', () => {
    const pkg = readPackageJson(MINIMAL_PROJECT)

    expect(pkg.dependencies).toBeDefined()
    expect(pkg.dependencies?.['lodash']).toBe('^4.17.21')
  })

  it('parses devDependencies', () => {
    const pkg = readPackageJson(MINIMAL_PROJECT)

    expect(pkg.devDependencies).toBeDefined()
    expect(pkg.devDependencies?.['typescript']).toBe('^5.0.0')
  })

  it('parses peerDependencies', () => {
    const pkg = readPackageJson(MINIMAL_PROJECT)

    expect(pkg.peerDependencies).toBeDefined()
    expect(pkg.peerDependencies?.['react']).toBe('^18.0.0')
  })

  it('parses scripts', () => {
    const pkg = readPackageJson(MINIMAL_PROJECT)

    expect(pkg.scripts).toBeDefined()
    expect(pkg.scripts?.['test']).toBe('jest')
    expect(pkg.scripts?.['build']).toBe('tsc')
  })

  it('throws error for non-existent file', () => {
    expect(() => readPackageJson('/non/existent/path')).toThrow()
  })

  it('reads monorepo workspaces', () => {
    const pkg = readPackageJson(MONOREPO)

    expect(pkg.workspaces).toBeDefined()
    expect(Array.isArray(pkg.workspaces)).toBe(true)
    expect(pkg.workspaces).toContain('packages/*')
  })
})

describe('readPackageJsonIfExists', () => {
  it('returns package.json for existing project', () => {
    const pkg = readPackageJsonIfExists(MINIMAL_PROJECT)

    expect(pkg).not.toBeNull()
    expect(pkg?.name).toBe('minimal-test-project')
  })

  it('returns null for non-existent directory', () => {
    const pkg = readPackageJsonIfExists('/non/existent/path')

    expect(pkg).toBeNull()
  })

  it('returns null for empty directory', () => {
    const pkg = readPackageJsonIfExists(resolve(FIXTURES_DIR, 'empty'))

    expect(pkg).toBeNull()
  })
})

describe('findNearestPackageJson', () => {
  it('finds package.json in project root', () => {
    const result = findNearestPackageJson(MINIMAL_PROJECT)

    expect(result).toBe(MINIMAL_PROJECT)
  })

  it('finds package.json from nested directory', () => {
    const result = findNearestPackageJson(resolve(MINIMAL_PROJECT, 'src'))

    expect(result).toBe(MINIMAL_PROJECT)
  })

  it('finds package.json from deeply nested directory', () => {
    const result = findNearestPackageJson(resolve(MONOREPO, 'packages/core/src'))

    expect(result).toBe(resolve(MONOREPO, 'packages/core'))
  })

  it('returns null when no package.json found', () => {
    const result = findNearestPackageJson('/tmp')

    expect(result).toBeNull()
  })
})

describe('readPackageJson - validation edge cases', () => {
  beforeAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('throws error for malformed JSON', () => {
    writeFileSync(join(TEST_DIR, 'package.json'), '{invalid json}')
    expect(() => readPackageJson(TEST_DIR)).toThrow()
  })

  it('throws error for package.json that is not an object', () => {
    writeFileSync(join(TEST_DIR, 'package.json'), '"string value"')
    expect(() => readPackageJson(TEST_DIR)).toThrow()
  })

  it('throws error for package.json that is null', () => {
    writeFileSync(join(TEST_DIR, 'package.json'), 'null')
    expect(() => readPackageJson(TEST_DIR)).toThrow()
  })

  it('handles package.json that is an array by preserving array properties', () => {
    // Arrays are objects in JS, so they pass the typeof check but have no useful fields
    writeFileSync(join(TEST_DIR, 'package.json'), '[]')
    const pkg = readPackageJson(TEST_DIR)
    // Arrays have numeric keys and length, but no name/version
    expect(pkg.name).toBeUndefined()
    expect(pkg.version).toBeUndefined()
  })

  it('handles package.json with missing name field', () => {
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ version: '1.0.0' }))
    const pkg = readPackageJson(TEST_DIR)

    expect(pkg.name).toBeUndefined()
    expect(pkg.version).toBe('1.0.0')
  })

  it('handles package.json with non-string name field', () => {
    // Due to ...pkg spread, the raw value is preserved even if validation returns undefined
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 123, version: '1.0.0' }))
    const pkg = readPackageJson(TEST_DIR)

    // The spread preserves raw values, so we check the raw value is there
    expect(pkg['name']).toBe(123)
  })

  it('handles package.json with non-string version field', () => {
    // Due to ...pkg spread, the raw value is preserved
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test', version: 123 }))
    const pkg = readPackageJson(TEST_DIR)

    expect(pkg['version']).toBe(123)
  })

  it('handles scoped package names', () => {
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: '@org/pkg', version: '1.0.0' }))
    const pkg = readPackageJson(TEST_DIR)

    expect(pkg.name).toBe('@org/pkg')
  })

  it('handles unicode in package name', () => {
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test-日本語', version: '1.0.0' }))
    const pkg = readPackageJson(TEST_DIR)

    expect(pkg.name).toBe('test-日本語')
  })

  it('handles bin field as string', () => {
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test', bin: './cli.js' }))
    const pkg = readPackageJson(TEST_DIR)

    expect(pkg.bin).toBe('./cli.js')
  })

  it('handles bin field as object', () => {
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test', bin: { cli: './cli.js' } }))
    const pkg = readPackageJson(TEST_DIR)

    expect(pkg.bin).toEqual({ cli: './cli.js' })
  })

  it('handles invalid bin field type', () => {
    // Due to ...pkg spread, the raw value is preserved
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test', bin: 123 }))
    const pkg = readPackageJson(TEST_DIR)

    expect(pkg['bin']).toBe(123)
  })

  it('handles invalid bin field object with non-string values', () => {
    // Due to ...pkg spread, the raw value is preserved
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test', bin: { cli: 123 } }))
    const pkg = readPackageJson(TEST_DIR)

    expect(pkg['bin']).toEqual({ cli: 123 })
  })

  it('handles scripts with non-string values', () => {
    // Due to ...pkg spread, the raw value is preserved
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test', scripts: { test: 123 } }))
    const pkg = readPackageJson(TEST_DIR)

    expect(pkg['scripts']).toEqual({ test: 123 })
  })

  it('handles dependencies with non-string values', () => {
    // Due to ...pkg spread, the raw value is preserved
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test', dependencies: { lodash: 123 } }))
    const pkg = readPackageJson(TEST_DIR)

    expect(pkg['dependencies']).toEqual({ lodash: 123 })
  })

  it('handles workspaces as array', () => {
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test', workspaces: ['packages/*'] }))
    const pkg = readPackageJson(TEST_DIR)

    expect(pkg.workspaces).toEqual(['packages/*'])
  })

  it('handles workspaces as object with packages', () => {
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test', workspaces: { packages: ['packages/*'] } }))
    const pkg = readPackageJson(TEST_DIR)

    expect(pkg.workspaces).toEqual({ packages: ['packages/*'] })
  })

  it('handles workspaces as object without packages array', () => {
    // Due to ...pkg spread, the raw value is preserved
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test', workspaces: { nopackages: true } }))
    const pkg = readPackageJson(TEST_DIR)

    expect(pkg['workspaces']).toEqual({ nopackages: true })
  })

  it('handles workspaces as array with non-string values', () => {
    // Due to ...pkg spread, the raw value is preserved
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test', workspaces: [123, 'packages/*'] }))
    const pkg = readPackageJson(TEST_DIR)

    expect(pkg['workspaces']).toEqual([123, 'packages/*'])
  })

  it('handles engines field', () => {
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test', engines: { node: '>=18' } }))
    const pkg = readPackageJson(TEST_DIR)

    expect(pkg.engines).toEqual({ node: '>=18' })
  })

  it('handles exports field', () => {
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test', exports: { '.': './index.js' } }))
    const pkg = readPackageJson(TEST_DIR)

    expect(pkg.exports).toEqual({ '.': './index.js' })
  })

  it('preserves extra custom fields', () => {
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'test', customField: 'value' }))
    const pkg = readPackageJson(TEST_DIR)

    expect(pkg['customField']).toBe('value')
  })
})

describe('readPackageJsonIfExists - error handling', () => {
  beforeAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('returns null for malformed JSON', () => {
    writeFileSync(join(TEST_DIR, 'package.json'), '{invalid json}')
    const pkg = readPackageJsonIfExists(TEST_DIR)

    expect(pkg).toBeNull()
  })

  it('returns null for package.json that is not an object', () => {
    writeFileSync(join(TEST_DIR, 'package.json'), '"string"')
    const pkg = readPackageJsonIfExists(TEST_DIR)

    expect(pkg).toBeNull()
  })

  it('handles reading from direct path to package.json', () => {
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({ name: 'direct-path' }))
    const pkg = readPackageJsonIfExists(join(TEST_DIR, 'package.json'))

    expect(pkg?.name).toBe('direct-path')
  })
})
