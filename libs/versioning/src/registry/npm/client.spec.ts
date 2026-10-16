import { describe, expect, it } from '@hyperfrontend/testing'
import { escapePackageName, escapeVersion } from './client'

describe('escapePackageName', () => {
  it.each(['lodash', 'my-package', 'my_package', 'package123'])('allows the valid package name %p', (name) => {
    expect(escapePackageName(name)).toBe(name)
  })

  it.each(['@scope/package', '@hyperfrontend/utils'])('allows the scoped package name %p', (name) => {
    expect(escapePackageName(name)).toBe(name)
  })

  it('allows dots in package names', () => {
    expect(escapePackageName('dotenv.config')).toBe('dotenv.config')
  })

  it('throws for empty name', () => {
    expect(() => escapePackageName('')).toThrow('Package name is required')
  })

  it.each(['package; rm -rf /', 'package`whoami`', 'package$HOME'])('throws for the invalid character in %p', (name) => {
    expect(() => escapePackageName(name)).toThrow('Invalid character')
  })

  it('throws for names exceeding max length', () => {
    const longName = 'a'.repeat(300)
    expect(() => escapePackageName(longName)).toThrow('maximum length')
  })
})

describe('escapeVersion', () => {
  it.each(['1.0.0', '1.0.0-alpha.1', '1.0.0+build.123'])('allows the valid version %p', (version) => {
    expect(escapeVersion(version)).toBe(version)
  })

  it('throws for empty version', () => {
    expect(() => escapeVersion('')).toThrow('Version is required')
  })

  it.each(['1.0.0; ls', '1.0.0$(whoami)'])('throws for the invalid character in %p', (version) => {
    expect(() => escapeVersion(version)).toThrow('Invalid character')
  })
})
