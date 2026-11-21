import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { ChangelogEntry } from '../../changelog/models/entry'
import type { GitClient } from '../../git/factory'
import type { FlowResult } from '../models/types'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { isEntryContentEqual } from '../../changelog/compare'
import { parseChangelog } from '../../changelog/parse/parser'
import { createMockGitClient, createMockRegistry } from '../executor/__test-utils__/mocks'
import { dryRun } from '../executor/execute'
import { createConventionalFlow } from './conventional'

/** A commit of the history a flow run reads. */
interface HistoryCommit {
  /** The commit hash */
  readonly hash: string
  /** The whole commit message */
  readonly message: string
  /** Whether the commit changed a file of the project the flow runs for */
  readonly touchesProject: boolean
}

/** What a flow run is given: the project, its published version, the history, and what a resolver names. */
interface Release {
  /** The project the flow runs for, living under `libs/<name without lib->` */
  readonly projectName: string
  /** The version in the manifest, which the registry also reports as published */
  readonly version: string
  /** The history since the published version */
  readonly history: readonly HistoryCommit[]
  /** The commits that reach the project without touching its files, by the project they reach it through */
  readonly reaching?: Readonly<Record<string, readonly string[]>>
}

/**
 * Creates a git client whose log holds the history, and whose log of a path holds only the commits touching the project.
 *
 * @param history - The commits since the published version
 * @returns The git client
 */
function createGit(history: readonly HistoryCommit[]): GitClient {
  return {
    ...createMockGitClient(),
    getCommitLog: (options?: { path?: string }) =>
      options?.path === undefined ? history : history.filter((commit) => commit.touchesProject),
  } as unknown as GitClient
}

/**
 * Runs the conventional flow for a project, keeping the tree it wrote to.
 *
 * @param given - The project, its version, the history and the commits a resolver names
 * @returns The flow result and the tree holding the manifest and the changelog it wrote
 */
async function release(given: Release): Promise<{ result: FlowResult; tree: Tree; changelogPath: string }> {
  const projectRoot = `libs/${given.projectName.slice('lib-'.length)}`
  const tree = createMemoryTree({
    [`/workspace/${projectRoot}/package.json`]: JSON.stringify({ name: `@test/${given.projectName}`, version: given.version }),
  })
  const reaching = new Map(Object.entries(given.reaching ?? {}).map(([name, hashes]) => [name, new Set(hashes)]))
  const flow = createConventionalFlow({
    skipGit: true,
    scopeFiltering: given.reaching === undefined ? undefined : { dependencyCommits: () => reaching },
  })
  const result = await dryRun(flow, given.projectName, '/workspace', {
    tree,
    registry: createMockRegistry(given.version),
    git: createGit(given.history),
    projectRoot,
  })
  return { result, tree, changelogPath: `/workspace/${projectRoot}/CHANGELOG.md` }
}

const SECURITY: HistoryCommit = { hash: 'sec0001', message: 'security(lib-x): bump a vulnerable dependency', touchesProject: true }
const BREAKING_SECURITY: HistoryCommit = {
  hash: 'sec0002',
  message: 'security(lib-x)!: drop the option a vulnerable dependency needed',
  touchesProject: true,
}
const DOCS: HistoryCommit = { hash: 'doc0001', message: 'docs(lib-x): describe the option', touchesProject: true }
const ELSEWHERE_SECURITY: HistoryCommit = { ...SECURITY, touchesProject: false }
const BUILDER_SECURITY: HistoryCommit = {
  hash: 'sec0003',
  message: 'security(lib-builder): bump a vulnerable dependency of the builder',
  touchesProject: false,
}

describe('conventional flow with a security commit', () => {
  it('raises the project the commit is scoped to by a patch', async () => {
    const { result } = await release({ projectName: 'lib-x', version: '1.2.3', history: [SECURITY] })

    expect(result.state).toEqual(expect.objectContaining({ bumpType: 'patch', nextVersion: '1.2.4' }))
  })

  it('releases on a security commit alone, where a docs commit alone releases nothing', async () => {
    const secured = await release({ projectName: 'lib-x', version: '1.2.3', history: [SECURITY] })
    const documented = await release({ projectName: 'lib-x', version: '1.2.3', history: [DOCS] })

    expect({ security: secured.result.state.nextVersion, docs: documented.result.state.nextVersion }).toStrictEqual({
      security: '1.2.4',
      docs: undefined,
    })
  })

  it('raises a stable project by a major for a breaking security commit', async () => {
    const { result } = await release({ projectName: 'lib-x', version: '1.2.3', history: [BREAKING_SECURITY] })

    expect(result.state).toEqual(expect.objectContaining({ bumpType: 'major', nextVersion: '2.0.0' }))
  })

  it('raises a project below 1.0.0 by a minor for a breaking security commit', async () => {
    const { result } = await release({ projectName: 'lib-x', version: '0.4.2', history: [BREAKING_SECURITY] })

    expect(result.state).toEqual(expect.objectContaining({ bumpType: 'minor', nextVersion: '0.5.0' }))
  })

  it('lists the commit under the Security section of the changelog entry', async () => {
    const { result } = await release({ projectName: 'lib-x', version: '1.2.3', history: [SECURITY] })

    expect(result.state.changelogEntry?.sections).toEqual([
      expect.objectContaining({
        type: 'security',
        heading: 'Security',
        items: [expect.objectContaining({ description: 'bump a vulnerable dependency' })],
      }),
    ])
  })

  it('writes the commit under a Security heading in the changelog file', async () => {
    const { tree, changelogPath } = await release({ projectName: 'lib-x', version: '1.2.3', history: [SECURITY] })

    expect(tree.read(changelogPath, 'utf-8')).toContain('### Security\n\n- bump a vulnerable dependency\n')
  })

  it('lists a breaking security commit under both Breaking Changes and Security, in that order', async () => {
    const { result } = await release({ projectName: 'lib-x', version: '1.2.3', history: [BREAKING_SECURITY] })

    expect(result.state.changelogEntry?.sections.map((section) => section.heading)).toEqual(['Breaking Changes', 'Security'])
  })

  it('reads the written entry back equal to the generated one', async () => {
    const { result, tree, changelogPath } = await release({
      projectName: 'lib-x',
      version: '1.2.3',
      history: [SECURITY, BREAKING_SECURITY],
    })
    const written = parseChangelog(tree.read(changelogPath, 'utf-8') ?? '').entries[0]

    expect(isEntryContentEqual(written, result.state.changelogEntry as ChangelogEntry)).toBe(true)
  })
})

describe('conventional flow with a security commit that reaches a project through another', () => {
  it('raises a library shipping a copy of the secured one by a patch', async () => {
    const { result } = await release({
      projectName: 'lib-y',
      version: '2.0.0',
      history: [ELSEWHERE_SECURITY],
      reaching: { 'lib-x': [ELSEWHERE_SECURITY.hash] },
    })

    expect(result.state).toEqual(expect.objectContaining({ bumpType: 'patch', nextVersion: '2.0.1' }))
  })

  it('counts the commit as a dependency change of the library shipping the copy', async () => {
    const { result } = await release({
      projectName: 'lib-y',
      version: '2.0.0',
      history: [ELSEWHERE_SECURITY],
      reaching: { 'lib-x': [ELSEWHERE_SECURITY.hash] },
    })

    expect(result.state.classificationResult?.included).toEqual([
      expect.objectContaining({ source: 'indirect-dependency', dependencyPath: ['lib-x'] }),
    ])
  })

  it('keeps the library shipping the copy at a patch when the security commit breaks the secured one', async () => {
    const breaking: HistoryCommit = { ...BREAKING_SECURITY, touchesProject: false }
    const { result } = await release({
      projectName: 'lib-y',
      version: '2.0.0',
      history: [breaking],
      reaching: { 'lib-x': [breaking.hash] },
    })

    expect(result.state).toEqual(expect.objectContaining({ bumpType: 'patch', nextVersion: '2.0.1' }))
  })

  it('names the secured library beside the commit under Dependency Updates', async () => {
    const { result } = await release({
      projectName: 'lib-y',
      version: '2.0.0',
      history: [ELSEWHERE_SECURITY],
      reaching: { 'lib-x': [ELSEWHERE_SECURITY.hash] },
    })

    expect(result.state.changelogEntry?.sections).toEqual([
      expect.objectContaining({
        heading: 'Dependency Updates',
        items: [expect.objectContaining({ scope: 'lib-x', description: 'bump a vulnerable dependency' })],
      }),
    ])
  })

  it('raises a library by a patch for a security commit to the builder that builds it', async () => {
    const { result } = await release({
      projectName: 'lib-y',
      version: '2.0.0',
      history: [BUILDER_SECURITY],
      reaching: { 'lib-builder': [BUILDER_SECURITY.hash] },
    })

    expect(result.state).toEqual(expect.objectContaining({ bumpType: 'patch', nextVersion: '2.0.1' }))
  })

  it('releases nothing for a security commit that neither touches the library nor reaches it', async () => {
    const { result } = await release({ projectName: 'lib-y', version: '2.0.0', history: [ELSEWHERE_SECURITY], reaching: {} })

    expect(result.state.nextVersion).toBeUndefined()
  })
})
