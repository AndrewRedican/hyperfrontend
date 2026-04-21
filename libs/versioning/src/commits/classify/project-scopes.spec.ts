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
      expect(scopes).toContain('semver')
      expect(scopes).toContain('version-utils')
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
      expect(scopes).not.toContain('')
      expect(scopes).toContain('valid')
    })
  })
})

describe('scopeMatchesProject', () => {
  const projectScopes = ['lib-versioning', 'versioning']

  it('matches exact scope', () => {
    expect(scopeMatchesProject(['versioning'], projectScopes)).toBe(true)
    expect(scopeMatchesProject(['lib-versioning'], projectScopes)).toBe(true)
  })

  it('matches case-insensitively', () => {
    expect(scopeMatchesProject(['Versioning'], projectScopes)).toBe(true)
    expect(scopeMatchesProject(['VERSIONING'], projectScopes)).toBe(true)
  })

  it('matches when any scope in a multi-scope list matches', () => {
    expect(scopeMatchesProject(['logging', 'versioning'], projectScopes)).toBe(true)
    expect(scopeMatchesProject(['questions', 'cryptography'], projectScopes)).toBe(false)
  })

  it('returns false for non-matching scope', () => {
    expect(scopeMatchesProject(['logging'], projectScopes)).toBe(false)
    expect(scopeMatchesProject(['cryptography'], projectScopes)).toBe(false)
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
    expect(scopeIsExcluded(['release'], excludeScopes)).toBe(true)
    expect(scopeIsExcluded(['deps'], excludeScopes)).toBe(true)
    expect(scopeIsExcluded(['release', 'deps'], excludeScopes)).toBe(true)
  })

  it('matches case-insensitively', () => {
    expect(scopeIsExcluded(['Release'], excludeScopes)).toBe(true)
    expect(scopeIsExcluded(['DEPS'], excludeScopes)).toBe(true)
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
    expect(DEFAULT_EXCLUDE_SCOPES).toContain('release')
    expect(DEFAULT_EXCLUDE_SCOPES).toContain('deps')
    expect(DEFAULT_EXCLUDE_SCOPES).toContain('workspace')
    expect(DEFAULT_EXCLUDE_SCOPES).toContain('root')
    expect(DEFAULT_EXCLUDE_SCOPES).toContain('repo')
    expect(DEFAULT_EXCLUDE_SCOPES).toContain('ci')
    expect(DEFAULT_EXCLUDE_SCOPES).toContain('build')
  })
})

describe('DEFAULT_PROJECT_PREFIXES', () => {
  it('includes common project prefixes', () => {
    expect(DEFAULT_PROJECT_PREFIXES).toContain('lib-')
    expect(DEFAULT_PROJECT_PREFIXES).toContain('app-')
    expect(DEFAULT_PROJECT_PREFIXES).toContain('e2e-')
    expect(DEFAULT_PROJECT_PREFIXES).toContain('tool-')
    expect(DEFAULT_PROJECT_PREFIXES).toContain('plugin-')
    expect(DEFAULT_PROJECT_PREFIXES).toContain('feature-')
    expect(DEFAULT_PROJECT_PREFIXES).toContain('package-')
  })
})

describe('custom prefixes', () => {
  it('uses custom prefixes when provided', () => {
    const scopes = deriveProjectScopes({
      projectName: 'pkg-auth',
      prefixes: ['pkg-', 'svc-'],
    })
    expect(scopes).toContain('pkg-auth')
    expect(scopes).toContain('auth')
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
    expect(scopes).toContain('lib-versioning')
    expect(scopes).toContain('versioning')
  })
})
