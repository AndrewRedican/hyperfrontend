import type { Mock } from '@hyperfrontend/testing'
import type { TaskDecision, WorkspaceGraph } from '../../../graph'
import { execFileSync } from 'node:child_process'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { changeSet, EdgeKind, selectAffected } from '../../../graph'
import { graphChangeSources, parseCommitFiles, selectReleaseBuilds, withShippedChanges } from './graph-change-sources'
jest.mock('../../../graph', () => ({
  ...jest.requireActual<typeof import('../../../graph')>('../../../graph'),
  changeSet: jest.fn(() => ({ files: [] })),
  previousWorkspaceFile: jest.fn(),
  selectAffected: jest.fn(),
}))

const mockSelect = selectAffected as Mock
const mockChanges = changeSet as Mock

/** A decision the selection answers for the build of `lib-a`. */
const DECISION = { task: 'lib-a:build', reasons: [] } as unknown as TaskDecision

/** A graph with one tool edge and one import edge, as far as these cases read it. */
const GRAPH = {
  records: [
    { kind: EdgeKind.Tool, from: 'project:lib-a', to: 'tool:x' },
    { kind: EdgeKind.Value, from: 'file:libs/a/index.ts', to: 'file:libs/b/index.ts' },
  ],
} as unknown as WorkspaceGraph

beforeEach(() => {
  mockSelect.mockReset().mockReturnValue(new Map([['build', { selected: [DECISION] }]]))
  mockChanges.mockClear()
})

const repository = useTempDir()

/**
 * Runs git in the temporary repository with a fixed identity.
 *
 * @param args - The git arguments
 * @returns What git printed, trimmed
 */
function git(...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], {
    cwd: repository.path,
    encoding: 'utf8',
  }).trim()
}

/**
 * Writes files and commits them.
 *
 * @param files - The content of each file by path
 * @returns The hash of the new commit
 */
function commit(files: Readonly<Record<string, string>>): string {
  for (const [path, content] of Object.entries(files)) repository.write(path, content)
  git('add', '-A')
  git('commit', '--no-verify', '-m', 'a change')
  return git('rev-parse', 'HEAD')
}

describe('parseCommitFiles', () => {
  it('lists each commit under every path it changed', () => {
    const found = parseCommitFiles('\u0000aaa\n\nlibs/a.ts\nlibs/b.ts\n\u0000bbb\n\nlibs/b.ts\n')

    expect(Object.fromEntries([...found].map(([path, hashes]) => [path, [...hashes]]))).toEqual({
      'libs/a.ts': ['aaa'],
      'libs/b.ts': ['aaa', 'bbb'],
    })
  })

  it('finds no paths in an empty log', () => {
    expect(parseCommitFiles('').size).toBe(0)
  })

  it('finds no paths for a commit that changed no file', () => {
    expect(parseCommitFiles('\u0000aaa\n').size).toBe(0)
  })
})

describe('graphChangeSources', () => {
  it('reads the commits after the base by the files they changed', () => {
    git('init', '--quiet')
    const base = commit({ 'libs/a.ts': 'one\n' })
    const second = commit({ 'libs/a.ts': 'two\n', 'libs/b.ts': 'one\n' })
    const third = commit({ 'libs/b.ts': 'two\n' })

    const found = graphChangeSources({} as WorkspaceGraph, repository.path).commitsByFile(base)

    expect(Object.fromEntries([...found].map(([path, hashes]) => [path, [...hashes].sort()]))).toEqual({
      'libs/a.ts': [second],
      'libs/b.ts': [second, third].sort(),
    })
  })
})

describe('selectReleaseBuilds', () => {
  it('asks the selection for the build tasks of the change, with the tool edges left out', () => {
    const selected = selectReleaseBuilds(GRAPH, '/repo', 'base', 'head')
    expect({ selected, request: mockSelect.mock.calls[0]?.[0], changes: mockChanges.mock.calls[0] }).toEqual({
      selected: [DECISION],
      request: expect.objectContaining({ graph: expect.objectContaining({ records: [GRAPH.records[1]] }), targets: ['build'] }),
      changes: ['/repo', 'base', 'head'],
    })
  })

  it('answers no task when the selection has none for the build target', () => {
    mockSelect.mockReturnValue(new Map())
    expect(selectReleaseBuilds(GRAPH, '/repo', 'base', 'head')).toEqual([])
  })
})

describe('graphChangeSources().affectedBuilds', () => {
  it('reads the selection once per base commit', () => {
    const sources = graphChangeSources(GRAPH, '/repo')
    expect([sources.affectedBuilds('base'), sources.affectedBuilds('base'), mockSelect.mock.calls.length]).toEqual([
      [DECISION],
      [DECISION],
      1,
    ])
  })
})

describe('withShippedChanges', () => {
  it('keeps the configured filtering and adds the resolver', () => {
    const filtering = withShippedChanges({ excludeScopes: ['ci'] }, GRAPH, '/repo')
    expect({ excludeScopes: filtering.excludeScopes, resolver: typeof filtering.dependencyCommits }).toEqual({
      excludeScopes: ['ci'],
      resolver: 'function',
    })
  })

  it('adds the resolver to no configuration at all', () => {
    expect(typeof withShippedChanges(undefined, GRAPH, '/repo').dependencyCommits).toBe('function')
  })
})
