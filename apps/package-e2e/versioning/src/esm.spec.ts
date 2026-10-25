/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/versioning`
 * Tests that the package is importable and exports work correctly.
 * A second suite installs the packed tarball outside the workspace and drives it through plain Node child processes with no loader hooks, so every export entry and a real call are checked the way a consumer runs them.
 */

import type { NativeConsumer } from '../../shared/native-consumer'
import { join } from 'node:path'
import { before as beforeAll, after as afterAll } from 'node:test'
import { describe, it, expect } from '@hyperfrontend/testing'
import { createNativeConsumer, tarballFor } from '../../shared/native-consumer'

const PACKAGE = '@hyperfrontend/versioning'
const E2E_DIR = join(import.meta.dirname, '..')
// why: the setup installs the tarball from the npm cache, which takes a few seconds on a cold disk.
const SETUP_TIMEOUT = 120_000
const RUNNER = [
  "import { compare, format, increment, parseChangelog, parseConventionalCommit, parseVersion, serializeChangelog } from '@hyperfrontend/versioning'",
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
  'process.stdout.write(JSON.stringify(await main()))',
  '',
].join('\n')

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
      expect(result).toEqual(expect.objectContaining({ entries: expect.anything() }))
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
      expect(commit).toEqual(expect.objectContaining({ type: 'feat' }))
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
      const formatted = result.version ? format(result.version) : undefined
      expect({ success: result.success, formatted }).toEqual({ success: true, formatted: '1.2.3' })
    })

    it('increments a version', async () => {
      const { parseVersion, increment, format } = await import('@hyperfrontend/versioning')

      const result = parseVersion('1.0.0')
      const formatted = result.version ? format(increment(result.version, 'minor')) : undefined
      expect({ success: result.success, formatted }).toEqual({ success: true, formatted: '1.1.0' })
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

describe('@hyperfrontend/versioning ESM under plain Node in an isolated consumer', () => {
  let consumer: NativeConsumer

  beforeAll(
    () => {
      consumer = createNativeConsumer({ tarball: tarballFor(E2E_DIR, PACKAGE), packageName: PACKAGE })
      consumer.write('run.mjs', RUNNER)
    },
    { timeout: SETUP_TIMEOUT }
  )

  afterAll(() => {
    consumer.remove()
  })

  it('imports every export entry natively', () => {
    const loads = consumer.loadEntries('import')
    expect({ probed: loads.length > 0, failures: loads.filter((load) => !load.ok) }).toEqual({ probed: true, failures: [] })
  })

  it('bumps and compares versions, parses a commit and round-trips a changelog', () => {
    const run = consumer.node([join(consumer.path, 'run.mjs')])
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
