import type { Mock } from '@hyperfrontend/testing'
import type { ChangelogEntry, FlowResult } from '@hyperfrontend/versioning'
import type { ValidateVersionStateOptions } from './validate-version-state'
import { join } from 'node:path'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { getEntryByVersion, parseChangelog } from '@hyperfrontend/versioning/changelog'
import { executeFlow } from '@hyperfrontend/versioning/flow/executor'
import { formatValidationResult, validateVersionState } from './validate-version-state'
jest.mock('@hyperfrontend/versioning/flow/executor', () => ({ executeFlow: jest.fn() }))

const mockFlow = executeFlow as Mock

const workspace = useTempDir({ prefix: 'validate-version-' })

beforeEach(() => {
  mockFlow.mockReset()
})

/**
 * A changelog holding one release.
 *
 * @param version - The version of the release
 * @param date - The date it is stamped with
 * @param item - The one feature it lists
 * @returns The markdown
 */
function changelog(version: string, date = '2026-01-01', item = 'add a thing'): string {
  return `# Changelog\n\n## [${version}] - ${date}\n\n### Features\n\n- ${item}\n`
}

/**
 * The entry of a release, as the changelog parser reads it.
 *
 * @param markdown - The changelog
 * @param version - The release
 * @returns Its entry
 */
function entryOf(markdown: string, version: string): ChangelogEntry | undefined {
  return getEntryByVersion(parseChangelog(markdown), version)
}

/**
 * A flow that ran to the end and called for a bump.
 *
 * @param state - The state it ended in, over a minor bump to 1.1.0 from one commit
 * @returns The result
 */
function bumped(state: Partial<FlowResult['state']> = {}): FlowResult {
  return {
    status: 'success',
    steps: [],
    duration: 1,
    summary: 'done',
    state: { bumpType: 'minor', nextVersion: '1.1.0', commits: [{}], ...state } as FlowResult['state'],
  }
}

/**
 * Gives the library at `libs/core` the manifest and changelog a case reads.
 *
 * @param version - The version in its manifest, none when undefined
 * @param markdown - Its changelog, none when undefined
 */
function library(version: string | undefined, markdown?: string): void {
  workspace.write('libs/core/package.json', JSON.stringify({ name: '@scope/core', version }))
  if (markdown !== undefined) workspace.write('libs/core/CHANGELOG.md', markdown)
}

/**
 * Validates the library at `libs/core` of the temporary workspace.
 *
 * @param overrides - Options beyond the workspace's own
 * @returns The verdict
 */
function validate(overrides: Partial<ValidateVersionStateOptions> = {}): ReturnType<typeof validateVersionState> {
  return validateVersionState({ workspaceRoot: workspace.path, projectName: 'lib-core', projectRoot: 'libs/core', ...overrides })
}

describe('validateVersionState flow', () => {
  it('runs the flow read-only, on the project, inferring the repository', async () => {
    mockFlow.mockResolvedValue({ status: 'skipped', steps: [], state: {}, duration: 1, summary: 'nothing' })
    await validate()
    expect(mockFlow.mock.calls).toEqual([
      [
        expect.objectContaining({
          config: expect.objectContaining({ dryRun: true, skipGit: true, skipTag: true, skipChangelog: false, repository: 'inferred' }),
        }),
        'lib-core',
        workspace.path,
        { dryRun: true, verbose: false, projectRoot: 'libs/core' },
      ],
    ])
  })

  it('hands the flow the attribution, window, repository and verbosity of the task', async () => {
    mockFlow.mockResolvedValue({ status: 'skipped', steps: [], state: {}, duration: 1, summary: 'nothing' })
    const scopeFiltering = { strategy: 'hybrid', excludeScopes: ['ci'] } as ValidateVersionStateOptions['scopeFiltering']
    const repository = { provider: 'github', owner: 'acme', name: 'repo' } as unknown as ValidateVersionStateOptions['repository']
    await validate({ verbose: true, scopeFiltering, maxCommitFallback: 40, repository })
    expect(mockFlow.mock.calls[0]).toEqual([
      expect.objectContaining({ config: expect.objectContaining({ scopeFiltering, maxCommitFallback: 40, repository }) }),
      'lib-core',
      workspace.path,
      expect.objectContaining({ verbose: true }),
    ])
  })

  it.each([
    ['an error', new Error('registry down'), 'Failed to execute version flow: registry down'],
    ['anything else', 'gave up', 'Failed to execute version flow: gave up'],
  ])('reports the flow throwing %s as an error', async (_thrown, thrown, errorMessage) => {
    mockFlow.mockRejectedValue(thrown)
    expect(await validate()).toEqual({ status: 'error', library: 'lib-core', errorMessage, discrepancies: [] })
  })

  it.each([
    ['its summary', 'already published', 'already published'],
    ['a fallback', '', 'No version bump needed or already published'],
  ])('skips a skipped flow with %s as the reason', async (_reason, summary, skipReason) => {
    mockFlow.mockResolvedValue({ status: 'skipped', steps: [], state: {}, duration: 1, summary })
    expect(await validate()).toEqual({ status: 'skipped', library: 'lib-core', skipReason, discrepancies: [] })
  })

  it.each([
    ['its summary', 'a step broke', 'a step broke'],
    ['a fallback', '', 'Version flow failed'],
  ])('reports a failed flow as an error with %s as the message', async (_message, summary, errorMessage) => {
    mockFlow.mockResolvedValue({ status: 'failed', steps: [], state: {}, duration: 1, summary })
    expect(await validate()).toEqual({ status: 'error', library: 'lib-core', errorMessage, discrepancies: [] })
  })

  it.each([
    ['a bump of none', { bumpType: 'none', nextVersion: '1.0.0' }],
    ['no next version', { bumpType: 'minor', nextVersion: undefined }],
  ])('skips a flow that ended with %s', async (_ending, state) => {
    mockFlow.mockResolvedValue(bumped(state as Partial<FlowResult['state']>))
    expect(await validate()).toEqual({
      status: 'skipped',
      library: 'lib-core',
      skipReason: 'No version bump required based on commit analysis',
      discrepancies: [],
    })
  })

  it('reports an error when the project has no manifest to compare', async () => {
    mockFlow.mockResolvedValue(bumped())
    expect(await validate()).toEqual({
      status: 'error',
      library: 'lib-core',
      errorMessage: `Cannot read package.json at ${join(workspace.path, 'libs/core', 'package.json')}`,
      discrepancies: [],
    })
  })
})

describe('validateVersionState comparison', () => {
  it('passes a manifest and changelog that match the commits, naming both states', async () => {
    const markdown = changelog('1.1.0')
    const changelogEntry = entryOf(markdown, '1.1.0')
    mockFlow.mockResolvedValue(bumped({ changelogEntry, commits: [{}, {}] } as unknown as Partial<FlowResult['state']>))
    library('1.1.0', markdown)
    expect(await validate()).toEqual({
      status: 'valid',
      library: 'lib-core',
      expected: { version: '1.1.0', bumpType: 'minor', changelogEntry, commitCount: 2 },
      actual: { version: '1.1.0', hasVersionEntry: true, changelogEntry },
      discrepancies: [],
    })
  })

  it('counts no commits when the flow recorded none', async () => {
    mockFlow.mockResolvedValue(bumped({ commits: undefined }))
    library('1.1.0', changelog('1.1.0'))
    expect((await validate()).expected?.commitCount).toBe(0)
  })

  it('passes a committed entry whose date differs from the regenerated one', async () => {
    mockFlow.mockResolvedValue(bumped({ changelogEntry: entryOf(changelog('1.1.0', '2026-06-30'), '1.1.0') }))
    library('1.1.0', changelog('1.1.0', '2026-01-01'))
    expect((await validate()).status).toBe('valid')
  })

  it('passes a release entry on the strength of its version when the flow generated none to compare', async () => {
    mockFlow.mockResolvedValue(bumped({ changelogEntry: undefined }))
    library('1.1.0', changelog('1.1.0'))
    expect((await validate()).status).toBe('valid')
  })

  it('fails an entry whose content no longer describes the commits', async () => {
    mockFlow.mockResolvedValue(bumped({ changelogEntry: entryOf(changelog('1.1.0', '2026-01-01', 'add another thing'), '1.1.0') }))
    library('1.1.0', changelog('1.1.0', '2026-01-01', 'add a thing'))
    expect(await validate()).toEqual(
      expect.objectContaining({
        status: 'invalid',
        discrepancies: [
          {
            file: 'CHANGELOG.md',
            type: 'changelog-mismatch',
            expected: 'Changelog entry generated from current commits',
            actual: 'Existing entry differs from expected',
            remedy: 'Re-run versioning to regenerate changelog entry',
          },
        ],
      })
    )
  })

  it('fails a manifest behind its commits, naming the versioning run that fixes it', async () => {
    mockFlow.mockResolvedValue(bumped())
    library('1.0.0', changelog('1.1.0'))
    expect(await validate()).toEqual(
      expect.objectContaining({
        status: 'invalid',
        discrepancies: [
          {
            file: 'package.json',
            type: 'version-mismatch',
            expected: '1.1.0',
            actual: '1.0.0',
            remedy: 'Run: npx hf run lib-core:version',
          },
        ],
      })
    )
  })

  it('reads a manifest with no version as 0.0.0', async () => {
    mockFlow.mockResolvedValue(bumped())
    library(undefined, changelog('1.1.0'))
    expect((await validate()).actual?.version).toBe('0.0.0')
  })

  it('fails a changelog with no entry for the expected version', async () => {
    mockFlow.mockResolvedValue(bumped())
    library('1.1.0', changelog('1.0.0'))
    expect(await validate()).toEqual(
      expect.objectContaining({
        status: 'invalid',
        actual: { version: '1.1.0', hasVersionEntry: false, changelogEntry: undefined },
        discrepancies: [
          {
            file: 'CHANGELOG.md',
            type: 'changelog-missing',
            expected: 'Entry for version 1.1.0',
            actual: 'No entry found',
            remedy: 'Run: npx hf run lib-core:version\nThis will generate the changelog entry',
          },
        ],
      })
    )
  })

  it('reports a project with no changelog as missing the entry', async () => {
    mockFlow.mockResolvedValue(bumped())
    library('1.1.0')
    expect(await validate()).toEqual(
      expect.objectContaining({
        status: 'invalid',
        actual: { version: '1.1.0', hasVersionEntry: false, changelogEntry: undefined },
        discrepancies: [expect.objectContaining({ type: 'changelog-missing' })],
      })
    )
  })

  it('reports an unreadable changelog as missing the entry, not as a crash', async () => {
    mockFlow.mockResolvedValue(bumped())
    library('1.1.0')
    // why: a directory at the changelog's path exists but cannot be read as a file, which is the failure the read guards against
    workspace.mkdir('libs/core/CHANGELOG.md')
    expect(await validate()).toEqual(
      expect.objectContaining({ status: 'invalid', discrepancies: [expect.objectContaining({ type: 'changelog-missing' })] })
    )
  })

  it('lists both discrepancies when the manifest and the changelog both lag', async () => {
    mockFlow.mockResolvedValue(bumped())
    library('1.0.0', changelog('1.0.0'))
    expect((await validate()).discrepancies).toEqual([
      expect.objectContaining({ file: 'package.json', type: 'version-mismatch' }),
      expect.objectContaining({ file: 'CHANGELOG.md', type: 'changelog-missing' }),
    ])
  })
})

describe('formatValidationResult', () => {
  /** A discrepancy whose remedy runs over two lines. */
  const MISSING = {
    file: 'CHANGELOG.md',
    type: 'changelog-missing',
    expected: 'Entry for version 1.1.0',
    actual: 'No entry found',
    remedy: 'Run: npx hf run lib-core:version\r\nThis will generate the changelog entry',
  } as const

  it('confirms a valid library with its version', () => {
    expect(
      formatValidationResult({
        status: 'valid',
        library: 'lib-core',
        expected: { version: '1.1.0', bumpType: 'minor', commitCount: 1 },
        discrepancies: [],
      })
    ).toBe('✅ lib-core: version 1.1.0 matches expected')
  })

  it('gives the reason of a skip', () => {
    expect(formatValidationResult({ status: 'skipped', library: 'lib-core', skipReason: 'nothing to do', discrepancies: [] })).toBe(
      '⏭️  lib-core: nothing to do'
    )
  })

  it('gives the message of an error', () => {
    expect(formatValidationResult({ status: 'error', library: 'lib-core', errorMessage: 'flow broke', discrepancies: [] })).toBe(
      '⚠️  lib-core: flow broke'
    )
  })

  it('sets out both versions, each discrepancy, and the remedy of the first, indenting every line of it', () => {
    expect(
      formatValidationResult({
        status: 'invalid',
        library: 'lib-core',
        expected: { version: '1.1.0', bumpType: 'minor', commitCount: 3 },
        actual: { version: '1.0.0', hasVersionEntry: false },
        discrepancies: [
          MISSING,
          { file: 'package.json', type: 'version-mismatch', expected: '1.1.0', actual: '1.0.0', remedy: 'never printed' },
        ],
      }).split(/\r?\n/)
    ).toEqual([
      '❌ lib-core: version mismatch',
      '',
      'Expected: 1.1.0 (MINOR bump from 3 commit(s))',
      'Actual:   1.0.0',
      '',
      'Discrepancies:',
      '  - CHANGELOG.md: changelog-missing',
      '    Expected: Entry for version 1.1.0',
      '    Actual:   No entry found',
      '  - package.json: version-mismatch',
      '    Expected: 1.1.0',
      '    Actual:   1.0.0',
      '',
      'Remedy:',
      '  Run: npx hf run lib-core:version',
      '  This will generate the changelog entry',
    ])
  })

  it('leaves out the versions of an invalid result that has neither state, and the remedy when nothing is listed', () => {
    expect(formatValidationResult({ status: 'invalid', library: 'lib-core', discrepancies: [] }).split(/\r?\n/)).toEqual([
      '❌ lib-core: version mismatch',
      '',
      '',
      'Discrepancies:',
      '',
      'Remedy:',
    ])
  })
})
