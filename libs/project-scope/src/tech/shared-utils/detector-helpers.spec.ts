import type { PackageJson } from '../../project/package/types'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  collectAllDependencies,
  parseVersionString,
  locateConfigFile,
  filterScriptsByCommand,
  hasDependency,
  getDependencyVersion,
} from './detector-helpers'

describe('collectAllDependencies', () => {
  it('combines all dependency types', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
      devDependencies: { typescript: '^5.0.0' },
      peerDependencies: { 'react-dom': '^18.0.0' },
      optionalDependencies: { fsevents: '^2.3.0' },
    }
    const result = collectAllDependencies(pkg)
    expect(result).toEqual({
      react: '^18.0.0',
      typescript: '^5.0.0',
      'react-dom': '^18.0.0',
      fsevents: '^2.3.0',
    })
  })

  it('handles missing dependency sections', () => {
    const result = collectAllDependencies({ name: 'test', version: '1.0.0' })
    expect(result).toEqual({})
  })

  it('handles undefined package.json', () => {
    const result = collectAllDependencies(undefined)
    expect(result).toEqual({})
  })

  it('handles overlapping dependencies (later sections override)', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
      devDependencies: { react: '^18.1.0' },
    }
    const result = collectAllDependencies(pkg)
    // devDependencies should override dependencies due to spread order
    expect(result['react']).toBe('^18.1.0')
  })
})

describe('parseVersionString', () => {
  it('removes semver prefixes', () => {
    expect(parseVersionString('^18.0.0')).toBe('18.0.0')
    expect(parseVersionString('~4.5.6')).toBe('4.5.6')
    expect(parseVersionString('>=4.0.0')).toBe('4.0.0')
    expect(parseVersionString('>3.0.0')).toBe('3.0.0')
    expect(parseVersionString('<=2.0.0')).toBe('2.0.0')
    expect(parseVersionString('<1.0.0')).toBe('1.0.0')
  })

  it('handles version without prefix', () => {
    expect(parseVersionString('1.2.3')).toBe('1.2.3')
  })

  it('returns undefined for undefined input', () => {
    expect(parseVersionString(undefined)).toBeUndefined()
  })

  it('handles multiple prefix characters', () => {
    expect(parseVersionString('>=^~1.0.0')).toBe('1.0.0')
  })

  it('handles empty string', () => {
    expect(parseVersionString('')).toBe('')
  })

  it('handles all prefix characters', () => {
    expect(parseVersionString('^^^^1.0.0')).toBe('1.0.0')
  })
})

describe('locateConfigFile', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'config-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('finds first matching config file', () => {
    writeFileSync(join(tempDir, 'webpack.config.js'), '')
    const result = locateConfigFile(tempDir, ['vite.config.js', 'webpack.config.js'])
    expect(result).toBe('webpack.config.js')
  })

  it('returns undefined when no files match', () => {
    const result = locateConfigFile(tempDir, ['nonexistent.config.js'])
    expect(result).toBeUndefined()
  })

  it('returns first match when multiple files exist', () => {
    writeFileSync(join(tempDir, 'webpack.config.js'), '')
    writeFileSync(join(tempDir, 'vite.config.js'), '')
    const result = locateConfigFile(tempDir, ['vite.config.js', 'webpack.config.js'])
    expect(result).toBe('vite.config.js')
  })

  it('handles empty patterns array', () => {
    const result = locateConfigFile(tempDir, [])
    expect(result).toBeUndefined()
  })
})

describe('filterScriptsByCommand', () => {
  it('finds scripts containing command', () => {
    const scripts = {
      build: 'webpack build',
      dev: 'webpack serve',
      test: 'jest',
    }
    const result = filterScriptsByCommand(scripts, 'webpack')
    expect(result).toEqual(['build', 'dev'])
  })

  it('returns empty array for no matches', () => {
    const scripts = { test: 'jest' }
    const result = filterScriptsByCommand(scripts, 'webpack')
    expect(result).toEqual([])
  })

  it('handles undefined scripts', () => {
    const result = filterScriptsByCommand(undefined, 'webpack')
    expect(result).toEqual([])
  })

  it('handles empty scripts object', () => {
    const result = filterScriptsByCommand({}, 'webpack')
    expect(result).toEqual([])
  })

  it('matches partial command strings', () => {
    const scripts = { build: 'run-webpack-build' }
    const result = filterScriptsByCommand(scripts, 'webpack')
    expect(result).toEqual(['build'])
  })
})

describe('hasDependency', () => {
  it('finds dependency in dependencies', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
    }
    expect(hasDependency(pkg, 'react')).toBe(true)
  })

  it('finds dependency in devDependencies', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: { typescript: '^5.0.0' },
    }
    expect(hasDependency(pkg, 'typescript')).toBe(true)
  })

  it('returns false for missing dependency', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
    }
    expect(hasDependency(pkg, 'vue')).toBe(false)
  })

  it('handles undefined package.json', () => {
    expect(hasDependency(undefined, 'react')).toBe(false)
  })

  it('handles package.json with no dependencies', () => {
    const pkg: PackageJson = { name: 'test', version: '1.0.0' }
    expect(hasDependency(pkg, 'react')).toBe(false)
  })
})

describe('getDependencyVersion', () => {
  it('gets version from dependencies', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
    }
    expect(getDependencyVersion(pkg, 'react')).toBe('18.0.0')
  })

  it('gets version from devDependencies', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      devDependencies: { typescript: '~5.0.0' },
    }
    expect(getDependencyVersion(pkg, 'typescript')).toBe('5.0.0')
  })

  it('returns undefined for missing dependency', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { react: '^18.0.0' },
    }
    expect(getDependencyVersion(pkg, 'vue')).toBeUndefined()
  })

  it('handles undefined package.json', () => {
    expect(getDependencyVersion(undefined, 'react')).toBeUndefined()
  })

  it('parses version from peerDependencies', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      peerDependencies: { 'react-dom': '>=18.0.0' },
    }
    expect(getDependencyVersion(pkg, 'react-dom')).toBe('18.0.0')
  })
})
