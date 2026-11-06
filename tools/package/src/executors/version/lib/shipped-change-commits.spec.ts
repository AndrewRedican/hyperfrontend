import type { ProjectRecord, Reason, TaskDecision } from '@hyperfrontend/workspace/graph'
import type { ChangeSources } from './shipped-change-commits'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createShippedChangeResolver } from './shipped-change-commits'

const OWNERS: Readonly<Record<string, { name: string; root: string }>> = {
  'libs/features/src/index.ts': { name: 'lib-features', root: 'libs/features' },
  'libs/builder/src/build.ts': { name: 'lib-builder', root: 'libs/builder' },
  'libs/builder/src/clean.ts': { name: 'lib-builder', root: 'libs/builder' },
  'libs/logging/src/index.ts': { name: 'lib-logging', root: 'libs/logging' },
  'tools/package/src/executors/build/executor.ts': { name: 'tool-package', root: 'tools/package' },
  'assets/media/features/banner.json': { name: 'hyperfrontend', root: '.' },
}

const graph = { projectOf: (file: string): ProjectRecord | null => (OWNERS[file] as ProjectRecord | undefined) ?? null }

/**
 * A reason the graph gives for selecting a build.
 *
 * @param rule - The rule that fired
 * @param file - The changed file the reason starts from, or null
 * @returns The reason, with no trace and no message
 */
function because(rule: Reason['rule'], file: string | null): Reason {
  return { rule, file, path: [], message: '' }
}

/**
 * Change sources that answer the same for every base commit.
 *
 * @param decisions - The selected build tasks
 * @param commits - The commit hashes by changed file
 * @returns Sources that ignore the base commit they are asked about
 */
function sourcesOf(decisions: readonly TaskDecision[], commits: Readonly<Record<string, readonly string[]>>): ChangeSources {
  return {
    affectedBuilds: () => decisions,
    commitsByFile: () => new Map(Object.entries(commits).map(([file, hashes]) => [file, new Set(hashes)])),
  }
}

/**
 * Resolves the commits reaching `lib-features` after the commit `base000`.
 *
 * @param reasons - The reasons its build was selected
 * @param commits - The commit hashes by changed file
 * @returns The commits by the project they reach the library through, as plain arrays
 */
function reaching(reasons: readonly Reason[], commits: Readonly<Record<string, readonly string[]>>): Record<string, string[]> {
  const resolve = createShippedChangeResolver(graph, sourcesOf([{ task: 'lib-features:build', reasons }], commits))
  const found = resolve({ projectName: 'lib-features', workspaceRoot: '/workspace', baseCommit: 'base000' })
  return Object.fromEntries([...found].map(([name, hashes]) => [name, [...hashes]]))
}

describe('createShippedChangeResolver', () => {
  it('names the commits that changed a file of a package the build reaches', () => {
    expect(reaching([because('reachable-from-entry', 'libs/builder/src/build.ts')], { 'libs/builder/src/build.ts': ['a1'] })).toEqual({
      'lib-builder': ['a1'],
    })
  })

  it('names the commits that changed a declared toolchain input', () => {
    expect(
      reaching([because('changed-input', 'tools/package/src/executors/build/executor.ts')], {
        'tools/package/src/executors/build/executor.ts': ['t1'],
      })
    ).toEqual({ 'tool-package': ['t1'] })
  })

  it('gathers the commits of every reaching file under the project that owns them', () => {
    expect(
      reaching(
        [
          because('reachable-from-entry', 'libs/builder/src/build.ts'),
          because('changed-input', 'libs/builder/src/clean.ts'),
          because('reachable-from-entry', 'libs/logging/src/index.ts'),
        ],
        { 'libs/builder/src/build.ts': ['a1', 'a2'], 'libs/builder/src/clean.ts': ['a2', 'a3'], 'libs/logging/src/index.ts': ['l1'] }
      )
    ).toEqual({ 'lib-builder': ['a1', 'a2', 'a3'], 'lib-logging': ['l1'] })
  })

  it('leaves out the files of the library itself', () => {
    expect(reaching([because('changed-input', 'libs/features/src/index.ts')], { 'libs/features/src/index.ts': ['f1'] })).toEqual({})
  })

  it('leaves out a global configuration change', () => {
    expect(reaching([because('global-config', 'package-lock.json')], { 'package-lock.json': ['g1'] })).toEqual({})
  })

  it('leaves out a file the workspace root owns', () => {
    expect(
      reaching([because('changed-input', 'assets/media/features/banner.json')], { 'assets/media/features/banner.json': ['m1'] })
    ).toEqual({})
  })

  it('leaves out a file no project owns', () => {
    expect(reaching([because('changed-input', 'orphan.txt')], { 'orphan.txt': ['o1'] })).toEqual({})
  })

  it('leaves out a reason no file started', () => {
    expect(reaching([because('dependent-task', null)], {})).toEqual({})
  })

  it('names a reaching project with no commits when history holds none for its file', () => {
    expect(reaching([because('reachable-from-entry', 'libs/builder/src/build.ts')], {})).toEqual({ 'lib-builder': [] })
  })

  it('finds nothing when the build of the library was not selected', () => {
    const resolve = createShippedChangeResolver(graph, sourcesOf([{ task: 'lib-logging:build', reasons: [] }], {}))

    expect(resolve({ projectName: 'lib-features', workspaceRoot: '/workspace', baseCommit: 'base000' }).size).toBe(0)
  })

  it('finds nothing and reads no history when there is no base commit', () => {
    const resolve = createShippedChangeResolver(graph, {
      affectedBuilds: () => {
        throw new Error('the graph was asked')
      },
      commitsByFile: () => {
        throw new Error('the history was read')
      },
    })

    expect(resolve({ projectName: 'lib-features', workspaceRoot: '/workspace', baseCommit: null }).size).toBe(0)
  })
})
