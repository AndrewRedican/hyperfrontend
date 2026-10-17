import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { Mocked } from '@hyperfrontend/testing'
import type { ConventionalCommit } from '../../../commits/models/conventional'
import type { GitClient } from '../../../git/factory'
import type { Registry } from '../../../registry/models/registry'
import type { Project } from '../../../workspace/models/project'
import { join } from 'node:path'
import { createDate } from '@hyperfrontend/immutable-api-utils/built-in-copy/date'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { normalizePath } from '@hyperfrontend/project-scope/core/path'
import { jest } from '@hyperfrontend/testing'
import { createProject } from '../../../workspace/models/project'

/** A pending virtual file system change reported by the mock tree. */
export interface MockFileChange {
  /** Workspace relative path the pending change applies to. */
  path: string
  /** Kind of pending change recorded against the path. */
  type: 'CREATE' | 'UPDATE' | 'DELETE'
}

/**
 * Builds an in-memory `Tree` backed by a plain map of file contents, optionally
 * reporting a fixed list of pending changes from `listChanges`.
 *
 * @param files - Absolute file path to file content pairs seeding the tree
 * @param changes - Pending changes the tree reports as uncommitted
 * @returns Tree usable as the `tree` option of `executeFlow`
 *
 * @example Seeding a manifest and one pending change
 * ```typescript
 * const tree = createMockTree({ '/workspace/libs/a/package.json': '{}' }, [{ path: 'libs/a/package.json', type: 'UPDATE' }])
 * ```
 */
export function createMockTree(files: Record<string, string> = {}, changes: MockFileChange[] = []): Tree {
  // why: the real tree keys every path portably, so the native joins the flow hands it must land on the POSIX seeds.
  const fileSystem = createMap(entries(files).map(([filePath, content]) => [normalizePath(filePath), content] as const))
  let pendingChanges = [...changes]

  const tree = {
    root: '/workspace',
    read(filePath: string, encoding?: string) {
      const content = fileSystem.get(normalizePath(filePath))
      if (content === undefined) {
        return null
      }
      return encoding ? content : Buffer.from(content)
    },
    write(filePath: string, content: string | Buffer) {
      fileSystem.set(normalizePath(filePath), typeof content === 'string' ? content : content.toString())
    },
    exists(filePath: string) {
      return fileSystem.has(normalizePath(filePath))
    },
    delete(filePath: string) {
      fileSystem.delete(normalizePath(filePath))
    },
    rename(from: string, to: string) {
      const content = fileSystem.get(normalizePath(from))
      if (content !== undefined) {
        fileSystem.set(normalizePath(to), content)
        fileSystem.delete(normalizePath(from))
      }
    },
    isFile(filePath: string) {
      return fileSystem.has(normalizePath(filePath))
    },
    children() {
      return []
    },
    listChanges() {
      return pendingChanges
    },
    clearChanges() {
      pendingChanges = []
    },
    changeFile(filePath: string, transform: (content: Buffer) => Buffer) {
      const content = tree.read(filePath, undefined)
      if (content === null) {
        throw createError(`File not found: ${filePath}`)
      }
      const buffer = typeof content === 'string' ? Buffer.from(content) : (content as Buffer)
      const result = transform(buffer)
      tree.write(filePath, result)
    },
  }

  return tree as unknown as Tree
}

/**
 * Builds a registry double that reports a single version as published.
 *
 * @param publishedVersion - Version the registry reports as published, or null when nothing is published
 * @returns Registry usable as the `registry` option of `executeFlow`
 *
 * @example Reporting 1.0.0 as already published
 * ```typescript
 * const registry = createMockRegistry('1.0.0')
 * ```
 */
export function createMockRegistry(publishedVersion: string | null = null): Registry {
  return {
    name: 'mock',
    url: 'https://mock.registry.com',
    async getLatestVersion() {
      return publishedVersion
    },
    async isVersionPublished(_packageName: string, version: string) {
      return version === publishedVersion
    },
    async getPackageInfo() {
      return null as unknown as Awaited<ReturnType<Registry['getPackageInfo']>>
    },
    async getVersionInfo() {
      return null as unknown as Awaited<ReturnType<Registry['getVersionInfo']>>
    },
    async listVersions() {
      return publishedVersion ? [publishedVersion] : []
    },
  }
}

/**
 * Builds a git client double whose log queries return the supplied commits and
 * whose write operations report success without touching a repository.
 *
 * @param commits - Partial conventional commits expanded into full log entries
 * @returns Git client usable as the `git` option of `executeFlow`
 *
 * @example Returning a single feature commit from the log
 * ```typescript
 * const git = createMockGitClient([{ type: 'feat', subject: 'add thing' }])
 * ```
 */
export function createMockGitClient(commits: readonly Partial<ConventionalCommit>[] = []): GitClient {
  const mockCommits = commits.map((c, i) => ({
    hash: `abc${i}`,
    message: `${c.type ?? 'feat'}${c.scope && c.scope.length > 0 ? `(${c.scope.join(',')})` : ''}: ${c.subject ?? 'test commit'}`,
    author: 'Test User',
    email: 'test@example.com',
    date: createDate().toISOString(),
    ...c,
  }))

  return {
    cwd: '/workspace',
    timeout: 30000,
    getCommitLog: () => mockCommits,
    getCommitsBetween: () => mockCommits,
    getCommitsSince: () => mockCommits,
    getCommit: () => mockCommits[0] ?? null,
    commitExists: () => true,
    getTags: () => [],
    getTag: () => null,
    createTag: (name: string) => ({
      name,
      hash: 'abc123',
      type: 'annotated' as const,
      message: 'Release',
      tagger: { name: 'Test', email: 'test@test.com', date: createDate() },
    }),
    deleteTag: () => true,
    tagExists: () => false,
    getLatestTag: () => null,
    getTagsForPackage: () => [],
    pushTag: () => true,
    createCommit: (message: string) => ({
      hash: 'newcommit123',
      message,
      author: 'Test',
      email: 'test@test.com',
      date: createDate().toISOString(),
      parents: [],
    }),
    stage: () => true,
    unstage: () => true,
    stageAll: () => true,
    amendCommit: (message: string) => ({
      hash: 'amended123',
      message,
      author: 'Test',
      email: 'test@test.com',
      date: createDate().toISOString(),
      parents: [],
    }),
    createEmptyCommit: (message: string) => ({
      hash: 'empty123',
      message,
      author: 'Test',
      email: 'test@test.com',
      date: createDate().toISOString(),
      parents: [],
    }),
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
  } as unknown as GitClient
}

/**
 * Builds a logger double whose methods are jest mocks, with `getLogLevel`
 * pre-seeded to report the `error` level.
 *
 * @returns Logger double recording every call for later assertions
 *
 * @example Asserting the flow logged its header line
 * ```typescript
 * const logger = createMockLogger()
 * await executeFlow(flow, 'lib-test', '/workspace', { tree, registry, git, logger })
 * expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('lib-test'))
 * ```
 */
export function createMockLogger(): Mocked<Logger> {
  return jest.mocked<Logger>({
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    setLogLevel: jest.fn(),
    getLogLevel: jest.fn().mockReturnValue('error'),
    channel: jest.fn(),
    timed: jest.fn(),
    timedAsync: jest.fn(),
  })
}

/**
 * Builds a complete project as workspace discovery would report it, deriving the
 * manifest path and contents from the supplied identity.
 *
 * @param identity - Name, version, and root path of the discovered project
 * @returns Project usable as the return value of a mocked `discoverProjectByName`
 *
 * @example Reporting a project found outside the Nx graph
 * ```typescript
 * discoverProjectByNameMock.mockReturnValue(createMockProject({ name: 'my-lib', path: '/workspace/packages/my-lib', version: '1.0.0' }))
 * ```
 */
export function createMockProject(identity: Pick<Project, 'name' | 'path' | 'version'>): Project {
  return createProject({
    ...identity,
    packageJsonPath: join(identity.path, 'package.json'),
    packageJson: { name: identity.name, version: identity.version },
  })
}
