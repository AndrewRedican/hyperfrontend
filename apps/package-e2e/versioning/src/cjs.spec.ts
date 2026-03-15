/**
 * CJS (CommonJS) E2E tests for @hyperfrontend/versioning
 * Tests that the package is requireable and exports work correctly.
 */

describe('@hyperfrontend/versioning CJS', () => {
  describe('main entry', () => {
    it('should be requireable', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const versioning = require('@hyperfrontend/versioning')
      expect(versioning).toBeDefined()
    })
  })

  describe('changelog module', () => {
    it('should export parseChangelog function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { parseChangelog } = require('@hyperfrontend/versioning')
      expect(typeof parseChangelog).toBe('function')
    })

    it('should export serializeChangelog function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { serializeChangelog } = require('@hyperfrontend/versioning')
      expect(typeof serializeChangelog).toBe('function')
    })

    it('should export createChangelog function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createChangelog } = require('@hyperfrontend/versioning')
      expect(typeof createChangelog).toBe('function')
    })

    it('should export createEmptyChangelog function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createEmptyChangelog } = require('@hyperfrontend/versioning')
      expect(typeof createEmptyChangelog).toBe('function')
    })

    it('should parse a simple changelog', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { parseChangelog } = require('@hyperfrontend/versioning')

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
    it('should export parseConventionalCommit function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { parseConventionalCommit } = require('@hyperfrontend/versioning')
      expect(typeof parseConventionalCommit).toBe('function')
    })

    it('should export isConventionalCommit function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isConventionalCommit } = require('@hyperfrontend/versioning')
      expect(typeof isConventionalCommit).toBe('function')
    })

    it('should parse a conventional commit message', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { parseConventionalCommit } = require('@hyperfrontend/versioning')

      const commit = parseConventionalCommit('feat: add new feature')
      expect(commit).toBeDefined()
      expect(commit.type).toBe('feat')
    })
  })

  describe('semver module', () => {
    it('should export parseVersion function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { parseVersion } = require('@hyperfrontend/versioning')
      expect(typeof parseVersion).toBe('function')
    })

    it('should export increment function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { increment } = require('@hyperfrontend/versioning')
      expect(typeof increment).toBe('function')
    })

    it('should export compare function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { compare } = require('@hyperfrontend/versioning')
      expect(typeof compare).toBe('function')
    })

    it('should export satisfies function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { satisfies } = require('@hyperfrontend/versioning')
      expect(typeof satisfies).toBe('function')
    })

    it('should export format function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { format } = require('@hyperfrontend/versioning')
      expect(typeof format).toBe('function')
    })

    it('should parse and format a version string', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { parseVersion, format } = require('@hyperfrontend/versioning')

      const result = parseVersion('1.2.3')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(format(result.version)).toBe('1.2.3')
      }
    })

    it('should increment a version', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { parseVersion, increment, format } = require('@hyperfrontend/versioning')

      const result = parseVersion('1.0.0')
      expect(result.success).toBe(true)
      if (result.success) {
        const incremented = increment(result.version, 'minor')
        expect(format(incremented)).toBe('1.1.0')
      }
    })
  })

  describe('flow module', () => {
    it('should export createConventionalFlow function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createConventionalFlow } = require('@hyperfrontend/versioning')
      expect(typeof createConventionalFlow).toBe('function')
    })

    it('should export createMinimalFlow function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createMinimalFlow } = require('@hyperfrontend/versioning')
      expect(typeof createMinimalFlow).toBe('function')
    })

    it('should export executeFlow function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { executeFlow } = require('@hyperfrontend/versioning')
      expect(typeof executeFlow).toBe('function')
    })

    it('should export createStep function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createStep } = require('@hyperfrontend/versioning')
      expect(typeof createStep).toBe('function')
    })
  })

  describe('workspace module', () => {
    it('should export createWorkspaceConfig function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createWorkspaceConfig } = require('@hyperfrontend/versioning')
      expect(typeof createWorkspaceConfig).toBe('function')
    })

    it('should export createWorkspace function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createWorkspace } = require('@hyperfrontend/versioning')
      expect(typeof createWorkspace).toBe('function')
    })

    it('should export createProject function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createProject } = require('@hyperfrontend/versioning')
      expect(typeof createProject).toBe('function')
    })
  })

  describe('git module', () => {
    it('should export createGitClient function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createGitClient } = require('@hyperfrontend/versioning')
      expect(typeof createGitClient).toBe('function')
    })

    it('should export DEFAULT_GIT_CLIENT_CONFIG constant', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DEFAULT_GIT_CLIENT_CONFIG } = require('@hyperfrontend/versioning')
      expect(DEFAULT_GIT_CLIENT_CONFIG).toBeDefined()
    })
  })

  describe('registry module', () => {
    it('should export createNpmRegistry function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createNpmRegistry } = require('@hyperfrontend/versioning')
      expect(typeof createNpmRegistry).toBe('function')
    })

    it('should export createRegistry function', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createRegistry } = require('@hyperfrontend/versioning')
      expect(typeof createRegistry).toBe('function')
    })
  })
})
