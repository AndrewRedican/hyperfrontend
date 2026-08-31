import { describe, expect, it } from '@hyperfrontend/testing'
import { escapePackageName, escapeVersion } from './client'

describe('escapePackageName', () => {
  it('allows valid package names', () => {
    expect(escapePackageName('lodash')).toBe('lodash')
    expect(escapePackageName('my-package')).toBe('my-package')
    expect(escapePackageName('my_package')).toBe('my_package')
    expect(escapePackageName('package123')).toBe('package123')
  })

  it('allows scoped packages', () => {
    expect(escapePackageName('@scope/package')).toBe('@scope/package')
    expect(escapePackageName('@hyperfrontend/utils')).toBe('@hyperfrontend/utils')
  })

  it('allows dots in package names', () => {
    expect(escapePackageName('dotenv.config')).toBe('dotenv.config')
  })

  it('throws for empty name', () => {
    expect(() => escapePackageName('')).toThrow('Package name is required')
  })

  it('throws for invalid characters', () => {
    expect(() => escapePackageName('package; rm -rf /')).toThrow('Invalid character')
    expect(() => escapePackageName('package`whoami`')).toThrow('Invalid character')
    expect(() => escapePackageName('package$HOME')).toThrow('Invalid character')
  })

  it('throws for names exceeding max length', () => {
    const longName = 'a'.repeat(300)
    expect(() => escapePackageName(longName)).toThrow('maximum length')
  })
})

describe('escapeVersion', () => {
  it('allows valid versions', () => {
    expect(escapeVersion('1.0.0')).toBe('1.0.0')
    expect(escapeVersion('1.0.0-alpha.1')).toBe('1.0.0-alpha.1')
    expect(escapeVersion('1.0.0+build.123')).toBe('1.0.0+build.123')
  })

  it('throws for empty version', () => {
    expect(() => escapeVersion('')).toThrow('Version is required')
  })

  it('throws for invalid characters', () => {
    expect(() => escapeVersion('1.0.0; ls')).toThrow('Invalid character')
    expect(() => escapeVersion('1.0.0$(whoami)')).toThrow('Invalid character')
  })
})
