/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/versioning`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `require` sees them.
 */

'use strict'

const { describe, it, expect } = require('@hyperfrontend/testing')
const { usePackedConsumer } = require('@hyperfrontend/testing/consumer')

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/versioning CJS', () => {
  it('requires every export entry', () => {
    expect(consumer.entries('require').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the main entry', () => {
    const surface = consumer.run(
      async () => {
        const entry = require('@hyperfrontend/versioning')
        return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof entry[name]]))
      },
      { kind: 'require' }
    )
    expect(surface).toEqual(
      expect.objectContaining({
        parseChangelog: 'function',
        serializeChangelog: 'function',
        createChangelog: 'function',
        createEmptyChangelog: 'function',
        parseConventionalCommit: 'function',
        isConventionalCommit: 'function',
        parseVersion: 'function',
        increment: 'function',
        compare: 'function',
        satisfies: 'function',
        format: 'function',
        createConventionalFlow: 'function',
        createMinimalFlow: 'function',
        executeFlow: 'function',
        createStep: 'function',
        createWorkspaceConfig: 'function',
        createWorkspace: 'function',
        createProject: 'function',
        createGitClient: 'function',
        createNpmRegistry: 'function',
        createRegistry: 'function',
        DEFAULT_GIT_CLIENT_CONFIG: 'object',
      })
    )
  })

  it('parses and formats a version string', () => {
    const formatted = consumer.run(
      async () => {
        const { format, parseVersion } = require('@hyperfrontend/versioning')
        const result = parseVersion('1.2.3')
        return [result.success, result.version ? format(result.version) : undefined]
      },
      { kind: 'require' }
    )
    expect(formatted).toEqual([true, '1.2.3'])
  })

  it('increments the minor version', () => {
    const bumped = consumer.run(
      async () => {
        const { format, increment, parseVersion } = require('@hyperfrontend/versioning')
        const result = parseVersion('1.0.0')
        return result.version ? format(increment(result.version, 'minor')) : undefined
      },
      { kind: 'require' }
    )
    expect(bumped).toBe('1.1.0')
  })

  it('orders two versions through compare', () => {
    const order = consumer.run(
      async () => {
        const { compare, parseVersion } = require('@hyperfrontend/versioning')
        const one = parseVersion('1.2.3').version
        const two = parseVersion('2.0.0').version
        return one && two ? compare(one, two) : undefined
      },
      { kind: 'require' }
    )
    expect(order).toBe(-1)
  })

  it('parses a conventional commit header into type, scope and subject', () => {
    const commit = consumer.run(
      async () => {
        const { parseConventionalCommit } = require('@hyperfrontend/versioning')
        const commit = parseConventionalCommit('feat(lib-x): add a thing')
        return { type: commit.type, scope: commit.scope, subject: commit.subject }
      },
      { kind: 'require' }
    )
    expect(commit).toEqual({
      type: 'feat',
      scope: ['lib-x'],
      subject: 'add a thing',
    })
  })

  it('recognises a conventional commit message', () => {
    const conventional = consumer.run(
      async () => {
        const { isConventionalCommit } = require('@hyperfrontend/versioning')
        return [isConventionalCommit('feat: add new feature'), isConventionalCommit('added a feature')]
      },
      { kind: 'require' }
    )
    expect(conventional).toEqual([true, false])
  })

  it('parses a changelog into its entries', () => {
    const entries = consumer.run(
      async () => {
        const { parseChangelog } = require('@hyperfrontend/versioning')
        const changelog = '# Changelog\n\n## 1.0.0 - 2024-01-15\n\n### Added\n\n- Initial release\n'
        return parseChangelog(changelog).entries.length
      },
      { kind: 'require' }
    )
    expect(entries).toBe(1)
  })

  it('serialises a parsed changelog back to the same text', () => {
    const fixpoint = consumer.run(
      async () => {
        const { parseChangelog, serializeChangelog } = require('@hyperfrontend/versioning')
        const changelog = '# Changelog\n\n## 1.0.0 - 2024-01-15\n\n### Added\n\n- Initial release\n'
        return serializeChangelog(parseChangelog(changelog)) === changelog
      },
      { kind: 'require' }
    )
    expect(fixpoint).toBe(true)
  })
})
