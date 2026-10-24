import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { writeFixtures } from '../../__test-utils__/write-fixtures'
import { readPackageJson, readPackageJsonIfExists, findNearestPackageJson } from './read'

const FIXTURES_DIR = writeFixtures()
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')
const MONOREPO = resolve(FIXTURES_DIR, 'monorepo')

describe('readPackageJson', () => {
  it('reads package.json from directory', () => {
    const pkg = readPackageJson(MINIMAL_PROJECT)

    expect(pkg).toEqual(expect.objectContaining({ name: 'minimal-test-project', version: '1.0.0' }))
  })

  it('reads package.json from direct path', () => {
    const pkg = readPackageJson(resolve(MINIMAL_PROJECT, 'package.json'))

    expect(pkg.name).toBe('minimal-test-project')
  })

  it('parses dependencies', () => {
    const pkg = readPackageJson(MINIMAL_PROJECT)

    expect(pkg.dependencies).toEqual(expect.objectContaining({ lodash: '^4.17.21' }))
  })

  it('parses devDependencies', () => {
    const pkg = readPackageJson(MINIMAL_PROJECT)

    expect(pkg.devDependencies).toEqual(expect.objectContaining({ typescript: '^5.0.0' }))
  })

  it('parses peerDependencies', () => {
    const pkg = readPackageJson(MINIMAL_PROJECT)

    expect(pkg.peerDependencies).toEqual(expect.objectContaining({ react: '^18.0.0' }))
  })

  it('parses scripts', () => {
    const pkg = readPackageJson(MINIMAL_PROJECT)

    expect(pkg.scripts).toEqual(expect.objectContaining({ test: 'jest', build: 'tsc' }))
  })

  it('throws error for non-existent file', () => {
    expect(() => readPackageJson('/non/existent/path')).toThrow()
  })

  it('reads monorepo workspaces', () => {
    const pkg = readPackageJson(MONOREPO)

    expect(pkg.workspaces).toEqual(expect.arrayContaining(['packages/*']))
  })
})

describe('readPackageJsonIfExists', () => {
  it('returns package.json for existing project', () => {
    const pkg = readPackageJsonIfExists(MINIMAL_PROJECT)

    expect(pkg).toEqual(expect.objectContaining({ name: 'minimal-test-project' }))
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
    const result = findNearestPackageJson(tmpdir())

    expect(result).toBeNull()
  })
})

describe('readPackageJson - validation edge cases', () => {
  const tempDir = useTempDir({ prefix: 'read-package-test-', scope: 'all' })

  it('throws error for malformed JSON', () => {
    writeFileSync(join(tempDir.path, 'package.json'), '{invalid json}')
    expect(() => readPackageJson(tempDir.path)).toThrow()
  })

  it('throws error for package.json that is not an object', () => {
    writeFileSync(join(tempDir.path, 'package.json'), '"string value"')
    expect(() => readPackageJson(tempDir.path)).toThrow()
  })

  it('throws error for package.json that is null', () => {
    writeFileSync(join(tempDir.path, 'package.json'), 'null')
    expect(() => readPackageJson(tempDir.path)).toThrow()
  })

  it('handles package.json that is an array by preserving array properties', () => {
    writeFileSync(join(tempDir.path, 'package.json'), '[]')
    const pkg = readPackageJson(tempDir.path)
    expect(pkg).toEqual(expect.objectContaining({ name: undefined, version: undefined }))
  })

  it('handles package.json with missing name field', () => {
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ version: '1.0.0' }))
    const pkg = readPackageJson(tempDir.path)

    expect(pkg).toEqual(expect.objectContaining({ name: undefined, version: '1.0.0' }))
  })

  it('handles package.json with non-string name field', () => {
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ name: 123, version: '1.0.0' }))
    const pkg = readPackageJson(tempDir.path)

    expect(pkg['name']).toBe(123)
  })

  it('handles package.json with non-string version field', () => {
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ name: 'test', version: 123 }))
    const pkg = readPackageJson(tempDir.path)

    expect(pkg['version']).toBe(123)
  })

  it('handles scoped package names', () => {
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ name: '@org/pkg', version: '1.0.0' }))
    const pkg = readPackageJson(tempDir.path)

    expect(pkg.name).toBe('@org/pkg')
  })

  it('handles unicode in package name', () => {
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ name: 'test-日本語', version: '1.0.0' }))
    const pkg = readPackageJson(tempDir.path)

    expect(pkg.name).toBe('test-日本語')
  })

  it('handles bin field as string', () => {
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ name: 'test', bin: './cli.js' }))
    const pkg = readPackageJson(tempDir.path)

    expect(pkg.bin).toBe('./cli.js')
  })

  it('handles bin field as object', () => {
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ name: 'test', bin: { cli: './cli.js' } }))
    const pkg = readPackageJson(tempDir.path)

    expect(pkg.bin).toEqual({ cli: './cli.js' })
  })

  it('handles invalid bin field type', () => {
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ name: 'test', bin: 123 }))
    const pkg = readPackageJson(tempDir.path)

    expect(pkg['bin']).toBe(123)
  })

  it('handles invalid bin field object with non-string values', () => {
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ name: 'test', bin: { cli: 123 } }))
    const pkg = readPackageJson(tempDir.path)

    expect(pkg['bin']).toEqual({ cli: 123 })
  })

  it('handles scripts with non-string values', () => {
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ name: 'test', scripts: { test: 123 } }))
    const pkg = readPackageJson(tempDir.path)

    expect(pkg['scripts']).toEqual({ test: 123 })
  })

  it('handles dependencies with non-string values', () => {
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ name: 'test', dependencies: { lodash: 123 } }))
    const pkg = readPackageJson(tempDir.path)

    expect(pkg['dependencies']).toEqual({ lodash: 123 })
  })

  it('handles workspaces as array', () => {
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ name: 'test', workspaces: ['packages/*'] }))
    const pkg = readPackageJson(tempDir.path)

    expect(pkg.workspaces).toEqual(['packages/*'])
  })

  it('handles workspaces as object with packages', () => {
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ name: 'test', workspaces: { packages: ['packages/*'] } }))
    const pkg = readPackageJson(tempDir.path)

    expect(pkg.workspaces).toEqual({ packages: ['packages/*'] })
  })

  it('handles workspaces as object without packages array', () => {
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ name: 'test', workspaces: { nopackages: true } }))
    const pkg = readPackageJson(tempDir.path)

    expect(pkg['workspaces']).toEqual({ nopackages: true })
  })

  it('handles workspaces as array with non-string values', () => {
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ name: 'test', workspaces: [123, 'packages/*'] }))
    const pkg = readPackageJson(tempDir.path)

    expect(pkg['workspaces']).toEqual([123, 'packages/*'])
  })

  it('handles engines field', () => {
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ name: 'test', engines: { node: '>=18' } }))
    const pkg = readPackageJson(tempDir.path)

    expect(pkg.engines).toEqual({ node: '>=18' })
  })

  it('handles exports field', () => {
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ name: 'test', exports: { '.': './index.js' } }))
    const pkg = readPackageJson(tempDir.path)

    expect(pkg.exports).toEqual({ '.': './index.js' })
  })

  it('preserves extra custom fields', () => {
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ name: 'test', customField: 'value' }))
    const pkg = readPackageJson(tempDir.path)

    expect(pkg['customField']).toBe('value')
  })
})

describe('readPackageJsonIfExists - error handling', () => {
  const tempDir = useTempDir({ prefix: 'read-package-test-', scope: 'all' })

  it('returns null for malformed JSON', () => {
    writeFileSync(join(tempDir.path, 'package.json'), '{invalid json}')
    const pkg = readPackageJsonIfExists(tempDir.path)

    expect(pkg).toBeNull()
  })

  it('returns null for package.json that is not an object', () => {
    writeFileSync(join(tempDir.path, 'package.json'), '"string"')
    const pkg = readPackageJsonIfExists(tempDir.path)

    expect(pkg).toBeNull()
  })

  it('handles reading from direct path to package.json', () => {
    writeFileSync(join(tempDir.path, 'package.json'), JSON.stringify({ name: 'direct-path' }))
    const pkg = readPackageJsonIfExists(join(tempDir.path, 'package.json'))

    expect(pkg?.name).toBe('direct-path')
  })
})
