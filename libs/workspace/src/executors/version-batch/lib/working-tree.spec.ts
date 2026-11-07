import type { TempDir } from '@hyperfrontend/testing/fs'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { after as afterAll, afterEach } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { restoreWorkingTree, snapshotWorkingTree, withRollback } from './working-tree'

const repositories: TempDir[] = []
afterAll(() => repositories.forEach((repository) => repository.remove()))
afterEach(() => jest.restoreAllMocks())

/**
 * Runs git in a repository, as a fixed identity.
 *
 * @param repository - Where git runs
 * @param args - The git arguments
 * @returns What git printed, trimmed
 */
function git(repository: TempDir, ...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@localhost', ...args], {
    cwd: repository.path,
    encoding: 'utf8',
  }).trim()
}

/**
 * A repository with two libraries committed, as a release batch finds one.
 *
 * @returns Its directory, with one commit holding the four files
 */
function repository(): TempDir {
  const directory = createTempDir({
    prefix: 'working-tree-',
    tree: {
      'libs/a/package.json': '{ "version": "1.0.0" }\n',
      'libs/a/src/index.ts': 'export const a = 1\n',
      'libs/b/package.json': '{ "version": "2.0.0" }\n',
      'notes.md': 'committed\n',
    },
  })
  repositories.push(directory)
  git(directory, 'init', '-q')
  git(directory, 'add', '-A')
  git(directory, 'commit', '-q', '-m', 'base')
  return directory
}

/**
 * What a release batch does to a repository: it bumps two manifests, stages one, and writes a changelog.
 *
 * @param directory - The repository the batch edits
 */
function batchEdits(directory: TempDir): void {
  directory.write('libs/a/package.json', '{ "version": "1.0.1" }\n')
  directory.write('libs/b/package.json', '{ "version": "2.0.1" }\n')
  directory.write('libs/a/CHANGELOG.md', '# 1.0.1\n')
  git(directory, 'add', 'libs/b/package.json')
}

/**
 * The text of a file of a repository.
 *
 * @param directory - The repository
 * @param file - The file, relative to it
 * @returns The content
 */
function read(directory: TempDir, file: string): string {
  return readFileSync(join(directory.path, file), 'utf8')
}

describe('snapshotWorkingTree', () => {
  it('records no changes for a clean tree', () => {
    expect(snapshotWorkingTree(repository().path).changes).toBeNull()
  })

  it('records the uncommitted changes of a tree that has some, as a commit', () => {
    const directory = repository()
    directory.write('notes.md', 'in progress\n')
    expect(snapshotWorkingTree(directory.path).changes).toMatch(/^[0-9a-f]{40}$/)
  })

  it('records the changes where git has no identity to commit as', () => {
    const directory = repository()
    directory.write('notes.md', 'in progress\n')
    jest.stubEnv('GIT_AUTHOR_NAME', '')
    jest.stubEnv('GIT_COMMITTER_NAME', '')
    expect(snapshotWorkingTree(directory.path).changes).toMatch(/^[0-9a-f]{40}$/)
  })

  it('records the untracked files', () => {
    const directory = repository()
    directory.write('scratch/draft.md', 'draft\n')
    expect([...snapshotWorkingTree(directory.path).untracked]).toEqual(['scratch/draft.md'])
  })

  it('leaves the tree, the index and the stash list as they were', () => {
    const directory = repository()
    directory.write('notes.md', 'in progress\n')
    git(directory, 'add', 'notes.md')
    directory.write('libs/a/src/index.ts', 'export const a = 2\n')
    const before = git(directory, 'status', '--porcelain')
    snapshotWorkingTree(directory.path)
    expect({ status: git(directory, 'status', '--porcelain'), stashes: git(directory, 'stash', 'list') }).toEqual({
      status: before,
      stashes: '',
    })
  })
})

describe('restoreWorkingTree', () => {
  it('puts a clean tree back to what was committed, and removes the files the run created', () => {
    const directory = repository()
    const snapshot = snapshotWorkingTree(directory.path)
    batchEdits(directory)
    restoreWorkingTree(directory.path, snapshot)
    expect(git(directory, 'status', '--porcelain')).toBe('')
  })

  it('keeps the edits that were in the tree before the run, in files the run never touched', () => {
    const directory = repository()
    directory.write('libs/a/src/index.ts', 'export const a = 2\n')
    const snapshot = snapshotWorkingTree(directory.path)
    batchEdits(directory)
    restoreWorkingTree(directory.path, snapshot)
    expect(read(directory, 'libs/a/src/index.ts')).toBe('export const a = 2\n')
  })

  it('puts back the edit that was in a file before the run edited it further', () => {
    const directory = repository()
    directory.write('libs/a/package.json', '{ "version": "1.0.0", "private": true }\n')
    const snapshot = snapshotWorkingTree(directory.path)
    batchEdits(directory)
    restoreWorkingTree(directory.path, snapshot)
    expect(read(directory, 'libs/a/package.json')).toBe('{ "version": "1.0.0", "private": true }\n')
  })

  it('leaves staged what was staged before the run, and unstages what the run staged', () => {
    const directory = repository()
    directory.write('notes.md', 'staged before\n')
    git(directory, 'add', 'notes.md')
    const snapshot = snapshotWorkingTree(directory.path)
    batchEdits(directory)
    restoreWorkingTree(directory.path, snapshot)
    expect(git(directory, 'diff', '--cached', '--name-only')).toBe('notes.md')
  })

  it('keeps a file that was untracked before the run', () => {
    const directory = repository()
    directory.write('scratch/draft.md', 'draft\n')
    const snapshot = snapshotWorkingTree(directory.path)
    batchEdits(directory)
    restoreWorkingTree(directory.path, snapshot)
    expect({ draft: read(directory, 'scratch/draft.md'), changelog: existsSync(join(directory.path, 'libs/a/CHANGELOG.md')) }).toEqual({
      draft: 'draft\n',
      changelog: false,
    })
  })

  it('leaves deleted a tracked file that was deleted before the run', () => {
    const directory = repository()
    rmSync(join(directory.path, 'notes.md'))
    const snapshot = snapshotWorkingTree(directory.path)
    batchEdits(directory)
    restoreWorkingTree(directory.path, snapshot)
    expect(existsSync(join(directory.path, 'notes.md'))).toBe(false)
  })
})

describe('withRollback', () => {
  /**
   * A note nobody reads.
   *
   * @returns Nothing
   */
  const quiet = (): void => undefined

  it('answers what the run returned and keeps its edits', async () => {
    const directory = repository()
    const result = await withRollback(directory.path, async () => (batchEdits(directory), 'done'), quiet)
    expect({ result, version: read(directory, 'libs/a/package.json') }).toEqual({ result: 'done', version: '{ "version": "1.0.1" }\n' })
  })

  it('puts the tree back as it stood when the run throws, edits in progress included', async () => {
    const directory = repository()
    directory.write('notes.md', 'in progress\n')
    await withRollback(directory.path, async () => (batchEdits(directory), Promise.reject(createError('failed'))), quiet).catch(quiet)
    expect(git(directory, 'status', '--porcelain')).toBe('M notes.md')
  })

  it('throws what the run threw', async () => {
    await expect(withRollback(repository().path, () => Promise.reject(createError('failed')), quiet)).rejects.toThrow('failed')
  })

  it('puts nothing back for a run that throws after its edits became final', async () => {
    const directory = repository()
    await withRollback(directory.path, async (keep) => (batchEdits(directory), keep(), Promise.reject(createError('late'))), quiet).catch(
      quiet
    )
    expect(read(directory, 'libs/a/package.json')).toBe('{ "version": "1.0.1" }\n')
  })

  it('listens for an interrupt only while the run is in flight', async () => {
    const before = process.listenerCount('SIGINT') + process.listenerCount('SIGTERM')
    let during = 0
    await withRollback(
      repository().path,
      async () => void (during = process.listenerCount('SIGINT') + process.listenerCount('SIGTERM')),
      quiet
    )
    expect({ during: during - before, after: process.listenerCount('SIGINT') + process.listenerCount('SIGTERM') - before }).toEqual({
      during: 2,
      after: 0,
    })
  })

  it('puts the tree back and exits 1 when the run is interrupted', async () => {
    const directory = repository()
    const exit = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    await withRollback(
      directory.path,
      async () => {
        batchEdits(directory)
        process.listeners('SIGINT').at(-1)?.('SIGINT')
      },
      quiet
    )
    expect({ status: git(directory, 'status', '--porcelain'), exit: exit.mock.calls }).toEqual({ status: '', exit: [[1]] })
  })

  it('exits without touching the tree when the interrupt arrives after the edits became final', async () => {
    const directory = repository()
    jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never)
    await withRollback(
      directory.path,
      async (keep) => {
        batchEdits(directory)
        keep()
        process.listeners('SIGTERM').at(-1)?.('SIGTERM')
      },
      quiet
    )
    expect(read(directory, 'libs/a/package.json')).toBe('{ "version": "1.0.1" }\n')
  })
})
