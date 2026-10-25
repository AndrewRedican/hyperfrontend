/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/versioning`
 * Tests that the package is requireable and exports work correctly.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

'use strict'

const { join } = require('node:path')
const { before: beforeAll, after: afterAll } = require('node:test')
const { describe, it, expect } = require('@hyperfrontend/testing')
const { createNativeConsumer, tarballFor } = require('../../shared/native-consumer')

const PACKAGE = '@hyperfrontend/versioning'
const E2E_DIR = join(__dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "'use strict'",
  "const { compare, format, increment, parseChangelog, parseConventionalCommit, parseVersion, serializeChangelog } = require('@hyperfrontend/versioning')",
  'async function main() {',
  "  const one = parseVersion('1.2.3').version",
  "  const two = parseVersion('2.0.0').version",
  "  const commit = parseConventionalCommit('feat(lib-x): add a thing')",
  "  const changelog = '# Changelog\\n\\n## 1.0.0 - 2024-01-15\\n\\n### Added\\n\\n- Initial release\\n'",
  '  const parsed = parseChangelog(changelog)',
  '  return {',
  "    bumped: format(increment(one, 'minor')),",
  '    order: compare(one, two),',
  '    commit: { type: commit.type, scope: commit.scope, subject: commit.subject },',
  '    entries: parsed.entries.length,',
  '    fixpoint: serializeChangelog(parsed) === changelog,',
  '  }',
  '}',
  'main().then((out) => process.stdout.write(JSON.stringify(out)))',
  '',
].join('\n')

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
      expect(result).toEqual(expect.objectContaining({ entries: expect.anything() }))
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
      expect(commit).toEqual(expect.objectContaining({ type: 'feat' }))
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
      const formatted = result.success ? format(result.version) : undefined
      expect({ success: result.success, formatted }).toEqual({ success: true, formatted: '1.2.3' })
    })

    it('increments a version', () => {
      const { parseVersion, increment, format } = require('@hyperfrontend/versioning')

      const result = parseVersion('1.0.0')
      const formatted = result.success ? format(increment(result.version, 'minor')) : undefined
      expect({ success: result.success, formatted }).toEqual({ success: true, formatted: '1.1.0' })
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

describe('@hyperfrontend/versioning CJS under plain Node in an isolated consumer', () => {
  let consumer

  beforeAll(
    () => {
      consumer = createNativeConsumer({ tarball: tarballFor(E2E_DIR, PACKAGE), packageName: PACKAGE })
      consumer.write('run.cjs', RUNNER)
    },
    { timeout: SETUP_TIMEOUT }
  )

  afterAll(() => {
    consumer.remove()
  })

  it('requires every export entry natively', () => {
    const loads = consumer.loadEntries('require')
    expect({ probed: loads.length > 0, failures: loads.filter((load) => !load.ok) }).toEqual({ probed: true, failures: [] })
  })

  it('bumps and compares versions, parses a commit and round-trips a changelog', () => {
    const run = consumer.node([join(consumer.path, 'run.cjs')])
    expect(run.status === 0 ? JSON.parse(run.stdout) : run.stderr).toEqual({
      bumped: '1.3.0',
      order: -1,
      commit: {
        type: 'feat',
        scope: ['lib-x'],
        subject: 'add a thing',
      },
      entries: 1,
      fixpoint: true,
    })
  })
})
