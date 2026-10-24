import type { Logger } from '@hyperfrontend/logging'
import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { ChangelogEntry, ChangelogItem } from '../../../changelog/models/entry'
import type { ConventionalCommit } from '../../../commits/models/conventional'
import type { GitClient } from '../../../git/factory'
import type { Registry } from '../../../registry/models/registry'
import type { FlowConfig, FlowContext, FlowState } from '../../models/types'
import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { createMock, jest } from '@hyperfrontend/testing'

/** Seed files for the in-memory tree the changelog steps read and write. */
export interface MockTreeOptions {
  /** Absolute path to file content, for example `{ '/workspace/libs/test/CHANGELOG.md': '# Changelog\n' }` */
  files?: Record<string, string>
}

/**
 * Builds an in-memory tree rooted at `/workspace` whose `write`, `delete` and
 * `rename` are spies that still reach the tree, so tests can assert on both the
 * call and the file it left behind.
 *
 * @param options - Seed files keyed by absolute path
 * @returns Tree preloaded with the supplied files
 *
 * @example Seeding an existing changelog before running the write step
 * ```typescript
 * const tree = createMockTree({ files: { '/workspace/libs/test/CHANGELOG.md': '# Changelog\n' } })
 * const written = (tree.write as jest.Mock).mock.calls[0][1] as string
 * ```
 */
export function createMockTree(options: MockTreeOptions = {}): Tree {
  const tree = createMemoryTree(options.files)
  jest.spyOn(tree, 'write')
  jest.spyOn(tree, 'delete')
  jest.spyOn(tree, 'rename')
  return tree
}

/**
 * Builds a git client whose head resolves to `abc123`, which is the hash the
 * compare URL assertions expect on the right-hand side of every range.
 *
 * @returns Git client answering `getHeadHash` with `abc123`
 *
 * @example Attaching the client to a hand-rolled context
 * ```typescript
 * const context = { ...createMockContext(), git: createMockGitClient() }
 * ```
 */
export function createMockGitClient(): GitClient {
  return createMock<GitClient>({ getHeadHash: () => 'abc123' })
}

/**
 * Builds a parsed conventional commit, defaulting to an unscoped `feat` so
 * tests only spell out the fields they assert on.
 *
 * @param overrides - Fields merged over the `feat: test commit` defaults
 * @returns Conventional commit ready to place in flow state
 *
 * @example Building a scoped breaking change
 * ```typescript
 * const commit = createMockCommit({ scope: ['api'], subject: 'new endpoint', breaking: true })
 * ```
 */
export function createMockCommit(overrides: Partial<ConventionalCommit> = {}): ConventionalCommit {
  return {
    type: 'feat',
    scope: [],
    subject: 'test commit',
    breaking: false,
    breakingDescription: undefined,
    body: undefined,
    footers: [],
    raw: 'feat: test commit',
    ...overrides,
  }
}

/**
 * Builds a changelog bullet carrying only a description, with no commit
 * references and no breaking marker.
 *
 * @param description - Bullet text as it renders under a section heading
 * @returns Changelog item for a section's `items` array
 *
 * @example Filling a features section with one bullet
 * ```typescript
 * const section = { type: 'features' as const, heading: 'Features', items: [createMockChangelogItem('New feature')] }
 * ```
 */
export function createMockChangelogItem(description: string): ChangelogItem {
  return { description, commits: [], references: [], breaking: false }
}

/**
 * Builds a released `1.0.0` changelog entry with a single features section, so
 * write-step tests can focus on file handling rather than entry shape.
 *
 * @param overrides - Fields merged over the released `1.0.0` defaults
 * @returns Changelog entry ready to place in flow state
 *
 * @example Writing a `0.2.0` entry with no sections
 * ```typescript
 * const entry = createMockChangelogEntry({ version: '0.2.0', sections: [] })
 * ```
 */
export function createMockChangelogEntry(overrides: Partial<ChangelogEntry> = {}): ChangelogEntry {
  return {
    version: '1.0.0',
    date: '2024-01-15',
    unreleased: false,
    sections: [
      {
        type: 'features' as const,
        heading: 'Features',
        items: [createMockChangelogItem('Feature 1')],
      },
    ],
    ...overrides,
  }
}

/**
 * Builds the flow context the changelog steps execute against, for the
 * `lib-test` project published as `@test/pkg` under the conventional preset.
 *
 * @param state - Flow state carried into the step
 * @param config - Config fragment merged over the conventional preset
 * @returns Flow context ready to hand to `step.execute`
 *
 * @example Running the generate step for a minor bump
 * ```typescript
 * const ctx = createMockContext({ nextVersion: '1.1.0', bumpType: 'minor', commits: [createMockCommit()] })
 * const result = await createGenerateChangelogStep().execute(ctx)
 * ```
 */
export function createMockContext(state: Partial<FlowState> = {}, config: Partial<FlowConfig> = {}): FlowContext {
  return {
    workspaceRoot: '/workspace',
    projectName: 'lib-test',
    projectRoot: '/workspace/libs/test',
    packageName: '@test/pkg',
    tree: createMockTree(),
    registry: createMock<Registry>(),
    git: createMockGitClient(),
    logger: createMock<Logger>(),
    config: { preset: 'conventional', ...config },
    state: { ...state },
  }
}
