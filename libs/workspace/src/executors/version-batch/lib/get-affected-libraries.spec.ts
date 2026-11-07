import type { Mock } from '@hyperfrontend/testing'
import { execFileSync } from 'node:child_process'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { getChangedFilesBetween } from '@hyperfrontend/versioning/git/operations'
import { workspaceGraph } from '../../../graph'
import { getAffectedLibraries, hasVersionTarget } from './get-affected-libraries'
jest.mock('@hyperfrontend/versioning/git/operations', () => {
  const actual = jest.requireActual<typeof import('@hyperfrontend/versioning/git/operations')>('@hyperfrontend/versioning/git/operations')
  return { ...actual, getChangedFilesBetween: jest.fn(actual.getChangedFilesBetween) }
})

const mockChanged = getChangedFilesBetween as Mock

/** The declared inputs of a build: the project's own files and those of what it depends on. */
const HF = {
  namedInputs: { production: ['{projectRoot}/**/*'] },
  targetDefaults: { build: { inputs: ['production', '^production'] } },
}

// why: lib-features imports lib-core, lib-docs has a build and no version target, and nothing owns the files outside libs/
const workspace = useTempDir({
  prefix: 'affected-libraries-',
  tree: {
    'hf.json': JSON.stringify(HF),
    'tsconfig.base.json': JSON.stringify({ compilerOptions: { paths: { '@fixture/core': ['libs/core/src/index.ts'] } } }),
    'notes.md': 'one\n',
    'libs/core/package.json': JSON.stringify({ name: '@fixture/core', exports: { '.': './src/index.js' } }),
    'libs/core/project.json': JSON.stringify({ name: 'lib-core', targets: { build: {}, version: {} } }),
    'libs/core/src/index.ts': 'export const core = 1\n',
    'libs/features/project.json': JSON.stringify({ name: 'lib-features', targets: { build: {}, version: {} } }),
    'libs/features/src/index.ts': "export { core } from '@fixture/core'\n",
    'libs/docs/project.json': JSON.stringify({ name: 'lib-docs', targets: { build: {} } }),
    'libs/docs/src/index.ts': 'export const docs = 1\n',
  },
})

/**
 * Runs git in the temporary workspace, as a fixed identity.
 *
 * @param args - The git arguments
 * @returns What git printed, trimmed
 */
function git(...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@localhost', '-c', 'commit.gpgsign=false', ...args], {
    cwd: workspace.path,
    encoding: 'utf8',
  }).trim()
}

/**
 * Commits the workspace as it stands.
 *
 * @returns The hash of the commit
 */
function commit(): string {
  git('add', '-A')
  git('commit', '-q', '--allow-empty', '-m', 'a change')
  return git('rev-parse', 'HEAD')
}

/**
 * Starts the repository, commits the workspace as the base of a change, and commits a change on top.
 *
 * @param files - The files the change writes, as workspace-relative paths
 * @returns The hash of the base commit
 */
function changed(files: readonly string[]): string {
  git('init', '-q')
  const base = commit()
  for (const file of files) workspace.write(file, 'export const changed = true\n')
  commit()
  return base
}

describe('getAffectedLibraries', () => {
  it('refuses a base that does not resolve, rather than answering no change', async () => {
    changed([])
    await expect(getAffectedLibraries(workspace.path, workspaceGraph(workspace.path), 'origin/absent', 'HEAD')).rejects.toThrow(
      'cannot compare origin/absent with HEAD'
    )
  })

  it('refuses a base that shares no history with the head, as in a shallow clone', async () => {
    const base = changed([])
    git('checkout', '-q', '--orphan', 'unrelated')
    // why: an orphan with the root commit's tree, message and second would be that same commit
    workspace.write('unrelated.txt', 'unrelated\n')
    commit()
    await expect(getAffectedLibraries(workspace.path, workspaceGraph(workspace.path), base, 'HEAD')).rejects.toThrow(
      `cannot compare ${base} with HEAD`
    )
  })

  it('finds nothing when nothing changed', async () => {
    const base = changed([])
    expect(await getAffectedLibraries(workspace.path, workspaceGraph(workspace.path), base, 'HEAD')).toEqual([])
  })

  it('finds a library that owns a changed file, and not the library it imports', async () => {
    const base = changed(['libs/features/src/index.ts'])
    expect(await getAffectedLibraries(workspace.path, workspaceGraph(workspace.path), base, 'HEAD')).toEqual(['lib-features'])
  })

  it('finds a library that owns no changed file when its build ships one', async () => {
    const base = changed(['libs/core/src/index.ts'])
    expect(await getAffectedLibraries(workspace.path, workspaceGraph(workspace.path), base, 'HEAD')).toEqual(['lib-core', 'lib-features'])
  })

  it('leaves out a project with no version target', async () => {
    const base = changed(['libs/docs/src/index.ts'])
    expect(await getAffectedLibraries(workspace.path, workspaceGraph(workspace.path), base, 'HEAD')).toEqual([])
  })

  it('leaves out a changed file no project owns', async () => {
    const base = changed(['notes.md'])
    expect(await getAffectedLibraries(workspace.path, workspaceGraph(workspace.path), base, 'HEAD')).toEqual([])
  })

  it('reads the change up to the head it is given', async () => {
    const base = changed(['libs/features/src/index.ts'])
    const head = git('rev-parse', 'HEAD')
    workspace.write('libs/core/src/index.ts', 'export const core = 2\n')
    commit()
    expect(await getAffectedLibraries(workspace.path, workspaceGraph(workspace.path), base, head)).toEqual(['lib-features'])
  })

  it('reads the change from origin/main to HEAD by default', async () => {
    const base = changed(['libs/features/src/index.ts'])
    git('update-ref', 'refs/remotes/origin/main', base)
    expect(await getAffectedLibraries(workspace.path, workspaceGraph(workspace.path))).toEqual(['lib-features'])
  })

  it('finds a changed file by its forward-slash path when git answers with backslashes', async () => {
    const base = changed([])
    mockChanged.mockReturnValueOnce(['libs\\features\\src\\index.ts'])
    expect(await getAffectedLibraries(workspace.path, workspaceGraph(workspace.path), base, 'HEAD')).toEqual(['lib-features'])
  })
})

describe('hasVersionTarget', () => {
  it.each([
    ['a project that declares the target', 'lib-core', true],
    ['a project that does not', 'lib-docs', false],
    ['a project the graph does not have', 'lib-missing', false],
  ])('answers for %s', (_project, name, versionable) => {
    git('init', '-q')
    expect(hasVersionTarget(workspaceGraph(workspace.path), name)).toBe(versionable)
  })
})
