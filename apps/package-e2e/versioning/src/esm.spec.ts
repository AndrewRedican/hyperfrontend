/**
 * ESM (ES Modules) E2E tests for @hyperfrontend/versioning
 * Tests that the package is importable and exports work correctly.
 */

describe('@hyperfrontend/versioning ESM', () => {
  describe('main entry', () => {
    it('should be importable', async () => {
      const versioning = await import('@hyperfrontend/versioning')
      expect(versioning).toBeDefined()
    })
  })

  describe('changelog module', () => {
    it('should export parseChangelog function', async () => {
      const { parseChangelog } = await import('@hyperfrontend/versioning')
      expect(typeof parseChangelog).toBe('function')
    })

    it('should export serializeChangelog function', async () => {
      const { serializeChangelog } = await import('@hyperfrontend/versioning')
      expect(typeof serializeChangelog).toBe('function')
    })

    it('should export createChangelog function', async () => {
      const { createChangelog } = await import('@hyperfrontend/versioning')
      expect(typeof createChangelog).toBe('function')
    })

    it('should export createEmptyChangelog function', async () => {
      const { createEmptyChangelog } = await import('@hyperfrontend/versioning')
      expect(typeof createEmptyChangelog).toBe('function')
    })

    it('should parse a simple changelog', async () => {
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
    it('should export parseConventionalCommit function', async () => {
      const { parseConventionalCommit } = await import('@hyperfrontend/versioning')
      expect(typeof parseConventionalCommit).toBe('function')
    })

    it('should export isConventionalCommit function', async () => {
      const { isConventionalCommit } = await import('@hyperfrontend/versioning')
      expect(typeof isConventionalCommit).toBe('function')
    })

    it('should parse a conventional commit message', async () => {
      const { parseConventionalCommit } = await import('@hyperfrontend/versioning')

      const commit = parseConventionalCommit('feat: add new feature')
      expect(commit).toBeDefined()
      expect(commit.type).toBe('feat')
    })
  })

  describe('semver module', () => {
    it('should export parseVersion function', async () => {
      const { parseVersion } = await import('@hyperfrontend/versioning')
      expect(typeof parseVersion).toBe('function')
    })

    it('should export increment function', async () => {
      const { increment } = await import('@hyperfrontend/versioning')
      expect(typeof increment).toBe('function')
    })

    it('should export compare function', async () => {
      const { compare } = await import('@hyperfrontend/versioning')
      expect(typeof compare).toBe('function')
    })

    it('should export satisfies function', async () => {
      const { satisfies } = await import('@hyperfrontend/versioning')
      expect(typeof satisfies).toBe('function')
    })

    it('should export format function', async () => {
      const { format } = await import('@hyperfrontend/versioning')
      expect(typeof format).toBe('function')
    })

    it('should parse and format a version string', async () => {
      const { parseVersion, format } = await import('@hyperfrontend/versioning')

      const result = parseVersion('1.2.3')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(format(result.version!)).toBe('1.2.3')
      }
    })

    it('should increment a version', async () => {
      const { parseVersion, increment, format } = await import('@hyperfrontend/versioning')

      const result = parseVersion('1.0.0')
      expect(result.success).toBe(true)
      if (result.success) {
        const incremented = increment(result.version!, 'minor')
        expect(format(incremented)).toBe('1.1.0')
      }
    })
  })

  describe('flow module', () => {
    it('should export createConventionalFlow function', async () => {
      const { createConventionalFlow } = await import('@hyperfrontend/versioning')
      expect(typeof createConventionalFlow).toBe('function')
    })

    it('should export createMinimalFlow function', async () => {
      const { createMinimalFlow } = await import('@hyperfrontend/versioning')
      expect(typeof createMinimalFlow).toBe('function')
    })

    it('should export executeFlow function', async () => {
      const { executeFlow } = await import('@hyperfrontend/versioning')
      expect(typeof executeFlow).toBe('function')
    })

    it('should export createStep function', async () => {
      const { createStep } = await import('@hyperfrontend/versioning')
      expect(typeof createStep).toBe('function')
    })
  })

  describe('workspace module', () => {
    it('should export createWorkspaceConfig function', async () => {
      const { createWorkspaceConfig } = await import('@hyperfrontend/versioning')
      expect(typeof createWorkspaceConfig).toBe('function')
    })

    it('should export createWorkspace function', async () => {
      const { createWorkspace } = await import('@hyperfrontend/versioning')
      expect(typeof createWorkspace).toBe('function')
    })

    it('should export createProject function', async () => {
      const { createProject } = await import('@hyperfrontend/versioning')
      expect(typeof createProject).toBe('function')
    })
  })

  describe('git module', () => {
    it('should export createGitClient function', async () => {
      const { createGitClient } = await import('@hyperfrontend/versioning')
      expect(typeof createGitClient).toBe('function')
    })

    it('should export DEFAULT_GIT_CLIENT_CONFIG constant', async () => {
      const { DEFAULT_GIT_CLIENT_CONFIG } = await import('@hyperfrontend/versioning')
      expect(DEFAULT_GIT_CLIENT_CONFIG).toBeDefined()
    })
  })

  describe('registry module', () => {
    it('should export createNpmRegistry function', async () => {
      const { createNpmRegistry } = await import('@hyperfrontend/versioning')
      expect(typeof createNpmRegistry).toBe('function')
    })

    it('should export createRegistry function', async () => {
      const { createRegistry } = await import('@hyperfrontend/versioning')
      expect(typeof createRegistry).toBe('function')
    })
  })
})
