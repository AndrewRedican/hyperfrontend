/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/versioning`
 * Tests that the package is requireable and exports work correctly.
 */

describe('@hyperfrontend/versioning CJS', () => {
  describe('main entry', () => {
    it('is requireable', () => {
      const versioning = require('@hyperfrontend/versioning')
      expect(versioning).toBeDefined()
    })
  })

  describe('changelog module', () => {
    it('exports parseChangelog function', () => {
      const { parseChangelog } = require('@hyperfrontend/versioning')
      expect(typeof parseChangelog).toBe('function')
    })

    it('exports serializeChangelog function', () => {
      const { serializeChangelog } = require('@hyperfrontend/versioning')
      expect(typeof serializeChangelog).toBe('function')
    })

    it('exports createChangelog function', () => {
      const { createChangelog } = require('@hyperfrontend/versioning')
      expect(typeof createChangelog).toBe('function')
    })

    it('exports createEmptyChangelog function', () => {
      const { createEmptyChangelog } = require('@hyperfrontend/versioning')
      expect(typeof createEmptyChangelog).toBe('function')
    })

    it('parses a simple changelog', () => {
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
    it('exports parseConventionalCommit function', () => {
      const { parseConventionalCommit } = require('@hyperfrontend/versioning')
      expect(typeof parseConventionalCommit).toBe('function')
    })

    it('exports isConventionalCommit function', () => {
      const { isConventionalCommit } = require('@hyperfrontend/versioning')
      expect(typeof isConventionalCommit).toBe('function')
    })

    it('parses a conventional commit message', () => {
      const { parseConventionalCommit } = require('@hyperfrontend/versioning')

      const commit = parseConventionalCommit('feat: add new feature')
      expect(commit).toBeDefined()
      expect(commit.type).toBe('feat')
    })
  })

  describe('semver module', () => {
    it('exports parseVersion function', () => {
      const { parseVersion } = require('@hyperfrontend/versioning')
      expect(typeof parseVersion).toBe('function')
    })

    it('exports increment function', () => {
      const { increment } = require('@hyperfrontend/versioning')
      expect(typeof increment).toBe('function')
    })

    it('exports compare function', () => {
      const { compare } = require('@hyperfrontend/versioning')
      expect(typeof compare).toBe('function')
    })

    it('exports satisfies function', () => {
      const { satisfies } = require('@hyperfrontend/versioning')
      expect(typeof satisfies).toBe('function')
    })

    it('exports format function', () => {
      const { format } = require('@hyperfrontend/versioning')
      expect(typeof format).toBe('function')
    })

    it('parses and formats a version string', () => {
      const { parseVersion, format } = require('@hyperfrontend/versioning')

      const result = parseVersion('1.2.3')
      expect(result.success).toBe(true)
      if (result.success) {
        expect(format(result.version)).toBe('1.2.3')
      }
    })

    it('increments a version', () => {
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
    it('exports createConventionalFlow function', () => {
      const { createConventionalFlow } = require('@hyperfrontend/versioning')
      expect(typeof createConventionalFlow).toBe('function')
    })

    it('exports createMinimalFlow function', () => {
      const { createMinimalFlow } = require('@hyperfrontend/versioning')
      expect(typeof createMinimalFlow).toBe('function')
    })

    it('exports executeFlow function', () => {
      const { executeFlow } = require('@hyperfrontend/versioning')
      expect(typeof executeFlow).toBe('function')
    })

    it('exports createStep function', () => {
      const { createStep } = require('@hyperfrontend/versioning')
      expect(typeof createStep).toBe('function')
    })
  })

  describe('workspace module', () => {
    it('exports createWorkspaceConfig function', () => {
      const { createWorkspaceConfig } = require('@hyperfrontend/versioning')
      expect(typeof createWorkspaceConfig).toBe('function')
    })

    it('exports createWorkspace function', () => {
      const { createWorkspace } = require('@hyperfrontend/versioning')
      expect(typeof createWorkspace).toBe('function')
    })

    it('exports createProject function', () => {
      const { createProject } = require('@hyperfrontend/versioning')
      expect(typeof createProject).toBe('function')
    })
  })

  describe('git module', () => {
    it('exports createGitClient function', () => {
      const { createGitClient } = require('@hyperfrontend/versioning')
      expect(typeof createGitClient).toBe('function')
    })

    it('exports DEFAULT_GIT_CLIENT_CONFIG constant', () => {
      const { DEFAULT_GIT_CLIENT_CONFIG } = require('@hyperfrontend/versioning')
      expect(DEFAULT_GIT_CLIENT_CONFIG).toBeDefined()
    })
  })

  describe('registry module', () => {
    it('exports createNpmRegistry function', () => {
      const { createNpmRegistry } = require('@hyperfrontend/versioning')
      expect(typeof createNpmRegistry).toBe('function')
    })

    it('exports createRegistry function', () => {
      const { createRegistry } = require('@hyperfrontend/versioning')
      expect(typeof createRegistry).toBe('function')
    })
  })
})
