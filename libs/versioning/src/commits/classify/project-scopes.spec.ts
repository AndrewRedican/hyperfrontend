import { describe, expect, it } from '@hyperfrontend/testing'
import {
  deriveProjectScopes,
  scopeMatchesProject,
  scopeIsExcluded,
  DEFAULT_EXCLUDE_SCOPES,
  DEFAULT_PROJECT_PREFIXES,
} from './project-scopes'

describe('deriveProjectScopes', () => {
  describe('project name variations', () => {
    it('includes the full project name', () => {
      const scopes = deriveProjectScopes({ projectName: 'lib-versioning' })
      expect(scopes).toContain('lib-versioning')
    })

    it('strips lib- prefix', () => {
      const scopes = deriveProjectScopes({ projectName: 'lib-versioning' })
      expect(scopes).toContain('versioning')
    })

    it('strips app- prefix', () => {
      const scopes = deriveProjectScopes({ projectName: 'app-demo' })
      expect(scopes).toContain('demo')
    })

    it('strips e2e- prefix', () => {
      const scopes = deriveProjectScopes({ projectName: 'e2e-cryptography' })
      expect(scopes).toContain('cryptography')
    })

    it('strips tool- prefix', () => {
      const scopes = deriveProjectScopes({ projectName: 'tool-package' })
      expect(scopes).toContain('package')
    })

    it('handles project names without prefixes', () => {
      const scopes = deriveProjectScopes({ projectName: 'cryptography' })
      expect(scopes).toEqual(['cryptography'])
    })
  })

  describe('package name variations', () => {
    it('extracts unscoped name from @scope/name', () => {
      const scopes = deriveProjectScopes({
        projectName: 'lib-versioning',
        packageName: '@hyperfrontend/versioning',
      })
      expect(scopes).toContain('versioning')
    })

    it('handles non-scoped package names', () => {
      const scopes = deriveProjectScopes({
        projectName: 'lib-demo',
        packageName: 'demo-app',
      })
      expect(scopes).toContain('demo-app')
    })

    it('deduplicates scope variations', () => {
      const scopes = deriveProjectScopes({
        projectName: 'lib-versioning',
        packageName: '@hyperfrontend/versioning',
      })
      const versioningCount = scopes.filter((s) => s === 'versioning').length
      expect(versioningCount).toBe(1)
    })
  })

  describe('additional scopes', () => {
    it('includes additional scopes', () => {
      const scopes = deriveProjectScopes({
        projectName: 'lib-versioning',
        additionalScopes: ['semver', 'version-utils'],
      })
      expect(scopes).toEqual(expect.arrayContaining(['semver', 'version-utils']))
    })

    it('deduplicates additional scopes', () => {
      const scopes = deriveProjectScopes({
        projectName: 'lib-versioning',
        additionalScopes: ['versioning', 'versioning'],
      })
      const versioningCount = scopes.filter((s) => s === 'versioning').length
      expect(versioningCount).toBe(1)
    })

    it('filters empty strings', () => {
      const scopes = deriveProjectScopes({
        projectName: 'lib-versioning',
        additionalScopes: ['', 'valid'],
      })
      expect(scopes).toEqual(['lib-versioning', 'versioning', 'valid'])
    })
  })
})

describe('scopeMatchesProject', () => {
  const projectScopes = ['lib-versioning', 'versioning']

  it('matches exact scope', () => {
    const commitScopes = [['versioning'], ['lib-versioning']]
    expect(commitScopes.map((scopes) => [scopes, scopeMatchesProject(scopes, projectScopes)])).toEqual(
      commitScopes.map((scopes) => [scopes, true])
    )
  })

  it('matches case-insensitively', () => {
    const commitScopes = [['Versioning'], ['VERSIONING']]
    expect(commitScopes.map((scopes) => [scopes, scopeMatchesProject(scopes, projectScopes)])).toEqual(
      commitScopes.map((scopes) => [scopes, true])
    )
  })

  it('matches when any scope in a multi-scope list matches', () => {
    expect(scopeMatchesProject(['logging', 'versioning'], projectScopes)).toBe(true)
  })

  it('returns false when no scope in a multi-scope list matches', () => {
    expect(scopeMatchesProject(['questions', 'cryptography'], projectScopes)).toBe(false)
  })

  it('returns false for non-matching scope', () => {
    const commitScopes = [['logging'], ['cryptography']]
    expect(commitScopes.map((scopes) => [scopes, scopeMatchesProject(scopes, projectScopes)])).toEqual(
      commitScopes.map((scopes) => [scopes, false])
    )
  })

  it('returns false for empty scope array', () => {
    expect(scopeMatchesProject([], projectScopes)).toBe(false)
  })

  it('returns false for array containing an empty string', () => {
    expect(scopeMatchesProject([''], projectScopes)).toBe(false)
  })
})

describe('scopeIsExcluded', () => {
  const excludeScopes = ['release', 'deps']

  it('returns true when all scopes are excluded', () => {
    const commitScopes = [['release'], ['deps'], ['release', 'deps']]
    expect(commitScopes.map((scopes) => [scopes, scopeIsExcluded(scopes, excludeScopes)])).toEqual(
      commitScopes.map((scopes) => [scopes, true])
    )
  })

  it('matches case-insensitively', () => {
    const commitScopes = [['Release'], ['DEPS']]
    expect(commitScopes.map((scopes) => [scopes, scopeIsExcluded(scopes, excludeScopes)])).toEqual(
      commitScopes.map((scopes) => [scopes, true])
    )
  })

  it('returns false for non-excluded scope', () => {
    expect(scopeIsExcluded(['versioning'], excludeScopes)).toBe(false)
  })

  it('returns false for mixed scopes (not every scope excluded)', () => {
    expect(scopeIsExcluded(['release', 'versioning'], excludeScopes)).toBe(false)
  })

  it('returns false for empty scope array', () => {
    expect(scopeIsExcluded([], excludeScopes)).toBe(false)
  })
})

describe('DEFAULT_EXCLUDE_SCOPES', () => {
  it('includes common infrastructure scopes', () => {
    expect(DEFAULT_EXCLUDE_SCOPES).toEqual(expect.arrayContaining(['release', 'deps', 'workspace', 'root', 'repo', 'ci', 'build']))
  })
})

describe('DEFAULT_PROJECT_PREFIXES', () => {
  it('includes common project prefixes', () => {
    expect(DEFAULT_PROJECT_PREFIXES).toEqual(expect.arrayContaining(['lib-', 'app-', 'e2e-', 'tool-', 'plugin-', 'feature-', 'package-']))
  })
})

describe('custom prefixes', () => {
  it('uses custom prefixes when provided', () => {
    const scopes = deriveProjectScopes({
      projectName: 'pkg-auth',
      prefixes: ['pkg-', 'svc-'],
    })
    expect(scopes).toEqual(['pkg-auth', 'auth'])
  })

  it('ignores default prefixes when custom provided', () => {
    const scopes = deriveProjectScopes({
      projectName: 'lib-auth',
      prefixes: ['pkg-'],
    })
    expect(scopes).toEqual(['lib-auth'])
  })

  it('handles empty prefixes array', () => {
    const scopes = deriveProjectScopes({
      projectName: 'lib-auth',
      prefixes: [],
    })
    expect(scopes).toEqual(['lib-auth'])
  })

  it('uses default prefixes when not specified', () => {
    const scopes = deriveProjectScopes({
      projectName: 'lib-versioning',
    })
    expect(scopes).toEqual(['lib-versioning', 'versioning'])
  })
})
