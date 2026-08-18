import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope/vfs'

import type { GitClient } from '../../../git/factory'
import type { Registry } from '../../../registry/models/registry'
import type { FlowConfig, FlowContext, FlowState } from '../../models/types'

/** Raw commit record as the git client hands it to the analyze-commits step. */
export interface MockCommit {
  /** Full commit message, parsed by the conventional-commit reader */
  message: string
  /** Commit sha used for scoping and classification bookkeeping */
  hash: string
}

/** Raw tag record returned by the mock git client's tag lookups. */
export interface MockTag {
  /** Tag label, for example `@test/pkg@1.0.0` */
  name: string
  /** Sha the tag points at */
  hash: string
}

/** Options accepted by `getCommitLog` on the mock git client. */
interface CommitLogOptions {
  /** Upper bound on the number of commits handed back */
  maxCount?: number
}

/** Knobs controlling what the mock git client reports back to the step. */
export interface MockGitClientOptions {
  /** Commit history handed to every log/range query */
  commits?: readonly MockCommit[]
  /** Tags reported for scoped package names such as `@test/pkg` */
  packageTags?: readonly MockTag[]
  /** Tags reported for bare project names such as `lib-test` */
  projectTags?: readonly MockTag[]
  /** Whether `commitReachableFromHead` reports the published commit as present */
  commitReachable?: boolean
}

/** Fields a test can swap out when building a flow context. */
export interface MockContextOverrides {
  /** Replacement git client, defaults to a client with no commits */
  git?: GitClient
  /** Replacement logger, defaults to a fresh set of jest spies */
  logger?: Logger
  /** Flow state carried into the step, defaults to an empty object */
  state?: FlowState
  /** Config fragment merged over the conventional-preset defaults */
  config?: Partial<FlowConfig>
  /** Nx project name, defaults to `lib-test` */
  projectName?: string
  /** Published package name, defaults to `@test/pkg` */
  packageName?: string
}

/**
 * Builds a logger whose every method is a jest spy, so tests can assert on the
 * debug and warn lines the analyze-commits step emits.
 *
 * @returns Logger backed by jest mock functions
 *
 * @example Asserting the step logged a first-release notice
 * ```typescript
 * const logger = createMockLogger()
 * await step.execute(createMockContext({ logger }))
 * expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('First release'))
 * ```
 */
export function createMockLogger(): Logger {
  return <Logger>(<unknown>{
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    setLogLevel: jest.fn(),
  })
}

/**
 * Builds an inert virtual file tree rooted at `/workspace`. The analyze-commits
 * step never reads from it, so every query answers empty.
 *
 * @returns Tree that reports no files and records writes on jest spies
 *
 * @example Attaching the tree to a hand-rolled context
 * ```typescript
 * const context = { ...createMockContext(), tree: createMockTree() }
 * ```
 */
export function createMockTree(): Tree {
  return <Tree>(<unknown>{
    root: '/workspace',
    read: () => null,
    write: jest.fn(),
    exists: () => false,
    delete: jest.fn(),
    rename: jest.fn(),
    isFile: () => false,
    children: () => [],
    listChanges: () => [],
  })
}

/**
 * Builds a registry that reports nothing published. Version lookups resolve to
 * `null` so the step treats the package as unreleased unless state says otherwise.
 *
 * @returns Registry whose queries all resolve empty
 *
 * @example Attaching the registry to a hand-rolled context
 * ```typescript
 * const context = { ...createMockContext(), registry: createMockRegistry() }
 * ```
 */
export function createMockRegistry(): Registry {
  return {
    name: 'mock',
    url: 'https://mock.registry.com',
    async getLatestVersion() {
      return null
    },
    async isVersionPublished() {
      return false
    },
    async getPackageInfo() {
      return null
    },
    async getVersionInfo() {
      return null
    },
    async listVersions() {
      return []
    },
  }
}

/**
 * Builds a git client that replays a fixed commit list for every history query
 * and answers the remaining surface with benign constants.
 *
 * @param options - Commit list, tag lists, and published-commit reachability
 * @returns Git client wired to the supplied history
 *
 * @example Replaying two commits since the published release
 * ```typescript
 * const git = createMockGitClient({
 *   commits: [{ message: 'feat: new feature', hash: 'ghi789' }],
 *   commitReachable: true,
 * })
 * ```
 */
export function createMockGitClient(options: MockGitClientOptions = {}): GitClient {
  const { commits = [], packageTags = [], projectTags = [], commitReachable = true } = options

  return <GitClient>(<unknown>{
    cwd: '/workspace',
    timeout: 30000,
    getCommitLog: (opts?: CommitLogOptions) => {
      if (opts?.maxCount) {
        return commits.slice(0, opts.maxCount)
      }
      return commits
    },
    getCommitsBetween: () => commits,
    getCommitsSince: () => commits,
    getCommit: () => (commits.length > 0 ? commits[0] : null),
    commitExists: () => true,
    commitReachableFromHead: () => commitReachable,
    getTags: () => [],
    getTag: () => null,
    createTag: jest.fn(),
    deleteTag: () => true,
    tagExists: () => false,
    getLatestTag: () => null,
    getTagsForPackage: (name: string) => {
      if (name.startsWith('@') || name.includes('/')) {
        return <MockTag[]>packageTags
      }
      return <MockTag[]>projectTags
    },
    pushTag: () => true,
    createCommit: jest.fn(),
    stage: () => true,
    unstage: () => true,
    stageAll: () => true,
    amendCommit: jest.fn(),
    createEmptyCommit: jest.fn(),
    getHead: () => 'abc123',
    getCurrentBranch: () => 'main',
    hasStagedChanges: () => false,
    hasUnstagedChanges: () => false,
    hasUntrackedFiles: () => false,
    getStatus: () => ({
      clean: true,
      entries: [],
      staged: [],
      unstaged: [],
      untracked: [],
    }),
    isClean: () => true,
    getRepositoryRoot: () => '/workspace',
    getHeadHash: () => 'abc123',
    getHeadShortHash: () => 'abc123',
    getModifiedFiles: () => [],
    getUntrackedFiles: () => [],
    getStagedFiles: () => [],
  })
}

/**
 * Builds the flow context the analyze-commits step executes against, with a
 * conventional preset and the four default release types already in place.
 *
 * @param overrides - Git client, logger, state, config, and naming swaps
 * @returns Flow context ready to hand to `step.execute`
 *
 * @example Running the step against a first release
 * ```typescript
 * const context = createMockContext({ git, state: { isFirstRelease: true } })
 * const result = await createAnalyzeCommitsStep().execute(context)
 * ```
 */
export function createMockContext(overrides?: MockContextOverrides): FlowContext {
  return {
    workspaceRoot: '/workspace',
    projectName: overrides?.projectName ?? 'lib-test',
    projectRoot: '/workspace/libs/test',
    packageName: overrides?.packageName ?? '@test/pkg',
    tree: createMockTree(),
    registry: createMockRegistry(),
    git: overrides?.git ?? createMockGitClient(),
    logger: overrides?.logger ?? createMockLogger(),
    config: {
      preset: 'conventional',
      releaseTypes: ['feat', 'fix', 'perf', 'revert'],
      ...overrides?.config,
    },
    state: overrides?.state ?? {},
  }
}
