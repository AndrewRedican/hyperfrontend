/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/versioning`
 * Tests that the package is importable and exports work correctly.
 */

describe('@hyperfrontend/versioning ESM', () => {
  describe('main entry', () => {
    it('is importable', async () => {
      const versioning = await import('@hyperfrontend/versioning')
      expect(versioning).toBeDefined()
    })
  })

  describe('changelog module', () => {
    it('exports parseChangelog function', async () => {
      const { parseChangelog } = await import('@hyperfrontend/versioning')
      expect(typeof parseChangelog).toBe('function')
    })

    it('exports serializeChangelog function', async () => {
      const { serializeChangelog } = await import('@hyperfrontend/versioning')
      expect(typeof serializeChangelog).toBe('function')
    })

    it('exports createChangelog function', async () => {
      const { createChangelog } = await import('@hyperfrontend/versioning')
      expect(typeof createChangelog).toBe('function')
    })

    it('exports createEmptyChangelog function', async () => {
      const { createEmptyChangelog } = await import('@hyperfrontend/versioning')
      expect(typeof createEmptyChangelog).toBe('function')
    })

    it('parses a simple changelog', async () => {
      const { parseChangelog } = await import('@hyperfrontend/versioning')

      const changelogContent = `# Changelog

## [1.0.0] - 2024-01-15

### Added
- Initial release
`
      const result = parseChangelog(changelogContent)
      expect(result).toBeDefined()
      expect(result.entries).toBeDefined()
    })
  })

  describe('commits module', () => {
    it('exports parseConventionalCommit function', async () => {
      const { parseConventionalCommit } = await import('@hyperfrontend/versioning')
      expect(typeof parseConventionalCommit).toBe('function')
    })

    it('exports isConventionalCommit function', async () => {
      const { isConventionalCommit } = await import('@hyperfrontend/versioning')
      expect(typeof isConventionalCommit).toBe('function')
    })

    it('parses a conventional commit message', async () => {
      const { parseConventionalCommit } = await import('@hyperfrontend/versioning')

      const commit = parseConventionalCommit('feat: add new feature')
      expect(commit).toBeDefined()
      expect(commit.type).toBe('feat')
    })
  })

  describe('semver module', () => {
    it('exports parseVersion function', async () => {
      const { parseVersion } = await import('@hyperfrontend/versioning')
      expect(typeof parseVersion).toBe('function')
    })

    it('exports increment function', async () => {
      const { increment } = await import('@hyperfrontend/versioning')
      expect(typeof increment).toBe('function')
    })

    it('exports compare function', async () => {
      const { compare } = await import('@hyperfrontend/versioning')
      expect(typeof compare).toBe('function')
    })

    it('exports satisfies function', async () => {
      const { satisfies } = await import('@hyperfrontend/versioning')
      expect(typeof satisfies).toBe('function')
    })

    it('exports format function', async () => {
      const { format } = await import('@hyperfrontend/versioning')
      expect(typeof format).toBe('function')
    })

    it('parses and formats a version string', async () => {
      const { parseVersion, format } = await import('@hyperfrontend/versioning')

      const result = parseVersion('1.2.3')
      expect(result.success).toBe(true)
      expect(result.version).toBeDefined()
      if (result.version) {
        expect(format(result.version)).toBe('1.2.3')
      }
    })

    it('increments a version', async () => {
      const { parseVersion, increment, format } = await import('@hyperfrontend/versioning')

      const result = parseVersion('1.0.0')
      expect(result.success).toBe(true)
      expect(result.version).toBeDefined()
      if (result.version) {
        const incremented = increment(result.version, 'minor')
        expect(format(incremented)).toBe('1.1.0')
      }
    })
  })

  describe('flow module', () => {
    it('exports createConventionalFlow function', async () => {
      const { createConventionalFlow } = await import('@hyperfrontend/versioning')
      expect(typeof createConventionalFlow).toBe('function')
    })

    it('exports createMinimalFlow function', async () => {
      const { createMinimalFlow } = await import('@hyperfrontend/versioning')
      expect(typeof createMinimalFlow).toBe('function')
    })

    it('exports executeFlow function', async () => {
      const { executeFlow } = await import('@hyperfrontend/versioning')
      expect(typeof executeFlow).toBe('function')
    })

    it('exports createStep function', async () => {
      const { createStep } = await import('@hyperfrontend/versioning')
      expect(typeof createStep).toBe('function')
    })
  })

  describe('workspace module', () => {
    it('exports createWorkspaceConfig function', async () => {
      const { createWorkspaceConfig } = await import('@hyperfrontend/versioning')
      expect(typeof createWorkspaceConfig).toBe('function')
    })

    it('exports createWorkspace function', async () => {
      const { createWorkspace } = await import('@hyperfrontend/versioning')
      expect(typeof createWorkspace).toBe('function')
    })

    it('exports createProject function', async () => {
      const { createProject } = await import('@hyperfrontend/versioning')
      expect(typeof createProject).toBe('function')
    })
  })

  describe('git module', () => {
    it('exports createGitClient function', async () => {
      const { createGitClient } = await import('@hyperfrontend/versioning')
      expect(typeof createGitClient).toBe('function')
    })

    it('exports DEFAULT_GIT_CLIENT_CONFIG constant', async () => {
      const { DEFAULT_GIT_CLIENT_CONFIG } = await import('@hyperfrontend/versioning')
      expect(DEFAULT_GIT_CLIENT_CONFIG).toBeDefined()
    })
  })

  describe('registry module', () => {
    it('exports createNpmRegistry function', async () => {
      const { createNpmRegistry } = await import('@hyperfrontend/versioning')
      expect(typeof createNpmRegistry).toBe('function')
    })

    it('exports createRegistry function', async () => {
      const { createRegistry } = await import('@hyperfrontend/versioning')
      expect(typeof createRegistry).toBe('function')
    })
  })
})
