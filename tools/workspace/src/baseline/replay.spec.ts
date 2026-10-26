import type { BaselineSelection } from './model'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { git, listMerges, lockfileSkew, replayMerges, withWorktree } from './replay'

const SELECTION: BaselineSelection = {
  base: '',
  head: '',
  projects: ['lib-a'],
  explanation: { affected: { 'lib-a:build': [] }, upstream: {}, touched: [], requested: { targets: ['build'], total: 1 } },
}

/** The identity the fixture repository commits with. */
const IDENTITY = {
  GIT_AUTHOR_NAME: 'replay',
  GIT_AUTHOR_EMAIL: 'replay@localhost',
  GIT_COMMITTER_NAME: 'replay',
  GIT_COMMITTER_EMAIL: 'replay@localhost',
}

const repo = useTempDir({ prefix: 'replay-' })

/**
 * Commits every change in the fixture repository.
 *
 * @param message - What the commit says
 * @returns The commit's sha
 */
function commit(message: string): string {
  git(repo.path, ['add', '-A'])
  git(repo.path, [
    '-c',
    `user.name=${IDENTITY.GIT_AUTHOR_NAME}`,
    '-c',
    `user.email=${IDENTITY.GIT_AUTHOR_EMAIL}`,
    'commit',
    '-q',
    '--allow-empty',
    '-m',
    message,
  ])
  return git(repo.path, ['rev-parse', 'HEAD'])
}

/**
 * Builds a repository with one merged branch: `main` holds the base commit and the merge, the
 * branch holds one commit on top of the base.
 *
 * @returns The base, the branch tip and the merge commit
 */
function repositoryWithMerge(): { base: string; head: string; merge: string } {
  git(repo.path, ['init', '-q', '--initial-branch=main'])
  repo.write('package-lock.json', '{ "lockfileVersion": 3 }\n')
  repo.write('README.md', '# fixture\n')
  const base = commit('base')
  git(repo.path, ['checkout', '-q', '-b', 'feature'])
  repo.write('libs/a/src/index.ts', 'export const a = 1\n')
  const head = commit('feature')
  git(repo.path, ['checkout', '-q', 'main'])
  repo.write('docs/note.md', 'main moved on\n')
  commit('main work')
  git(repo.path, [
    '-c',
    `user.name=${IDENTITY.GIT_AUTHOR_NAME}`,
    '-c',
    `user.email=${IDENTITY.GIT_AUTHOR_EMAIL}`,
    'merge',
    '-q',
    '--no-ff',
    '--no-edit',
    'feature',
  ])
  mkdirSync(repo.resolve('node_modules', 'left-pad'), { recursive: true })
  return { base, head, merge: git(repo.path, ['rev-parse', 'HEAD']) }
}

describe('listMerges', () => {
  it('reports the merge with the branch tip as head and the fork point as base', () => {
    const { base, head, merge } = repositoryWithMerge()
    expect(listMerges(repo.path, 'main', 10)).toEqual([
      { sha: merge, base, head, committedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) },
    ])
  })

  it('returns nothing for a branch without merges', () => {
    repositoryWithMerge()
    expect(listMerges(repo.path, 'feature', 10)).toEqual([])
  })
})

describe('lockfileSkew', () => {
  it('is false while the working tree holds the revision lock file', () => {
    const { head } = repositoryWithMerge()
    expect(lockfileSkew(repo.path, head)).toBe(false)
  })

  it('is true once the working tree lock file differs', () => {
    const { head } = repositoryWithMerge()
    repo.write('package-lock.json', '{ "lockfileVersion": 3, "packages": {} }\n')
    expect(lockfileSkew(repo.path, head)).toBe(true)
  })
})

describe('withWorktree', () => {
  it('checks the revision out beside a link to the installed packages', () => {
    const { head } = repositoryWithMerge()
    const seen = withWorktree(repo.path, head, (checkout) => ({
      files: readdirSync(checkout).sort(),
      packages: readdirSync(join(checkout, 'node_modules')),
      revision: git(checkout, ['rev-parse', 'HEAD']),
    }))
    expect(seen).toEqual({
      files: ['.git', 'README.md', 'libs', 'node_modules', 'package-lock.json'],
      packages: ['left-pad'],
      revision: head,
    })
  })

  it('removes the worktree after the work', () => {
    const { head } = repositoryWithMerge()
    const checkout = withWorktree(repo.path, head, (path) => path)
    expect({ exists: existsSync(checkout), worktrees: git(repo.path, ['worktree', 'list', '--porcelain']).split('\n\n').length }).toEqual({
      exists: false,
      worktrees: 1,
    })
  })

  it('removes the worktree when the work throws', () => {
    const { head } = repositoryWithMerge()
    let checkout = ''
    let thrown = ''
    try {
      withWorktree(repo.path, head, (path) => {
        checkout = path
        throw new Error('capture failed')
      })
    } catch (error) {
      thrown = (error as Error).message
    }
    expect({ thrown, exists: existsSync(checkout) }).toEqual({ thrown: 'capture failed', exists: false })
  })

  it('replaces a directory a previous run left behind', () => {
    const { head } = repositoryWithMerge()
    const stale = repo.resolve('.hf', 'replay', 'worktrees', head.slice(0, 12))
    mkdirSync(stale, { recursive: true })
    writeFileSync(join(stale, 'leftover.txt'), 'stale')
    expect(withWorktree(repo.path, head, (checkout) => existsSync(join(checkout, 'leftover.txt')))).toBe(false)
  })
})

describe('replayMerges', () => {
  it('writes one record per merge with the selection captured in the worktree', () => {
    const { base, head, merge } = repositoryWithMerge()
    const outDir = repo.resolve('.hf', 'replay')
    const capture = jest.fn((checkout: string, from: string, to: string) => ({ ...SELECTION, base: from, head: to, projects: [checkout] }))
    const records = replayMerges({ cwd: repo.path, ref: 'main', count: 10, outDir, capture, report: () => undefined })
    expect({ records, written: repo.readJson(join('.hf', 'replay', `${merge}.json`)) }).toEqual({
      records: [
        {
          sha: merge,
          base,
          head,
          committedAt: expect.any(String),
          lockfileSkew: false,
          selection: { ...SELECTION, base, head, projects: [repo.resolve('.hf', 'replay', 'worktrees', head.slice(0, 12))] },
        },
      ],
      written: records[0],
    })
  })

  it('reports each merge as it is captured', () => {
    const { merge } = repositoryWithMerge()
    const report = jest.fn((line: string) => line)
    replayMerges({ cwd: repo.path, ref: 'main', count: 10, outDir: repo.resolve('.hf', 'replay'), capture: () => SELECTION, report })
    expect(report.mock.calls).toEqual([[`${merge.slice(0, 12)} 1 projects, 1 tasks`]])
  })

  it('flags a merge whose lock file differs from the installed one', () => {
    const { merge } = repositoryWithMerge()
    repo.write('package-lock.json', '{ "lockfileVersion": 3, "packages": {} }\n')
    const report = jest.fn((line: string) => line)
    replayMerges({ cwd: repo.path, ref: 'main', count: 10, outDir: repo.resolve('.hf', 'replay'), capture: () => SELECTION, report })
    expect(report.mock.calls).toEqual([[`${merge.slice(0, 12)} 1 projects, 1 tasks, lockfile skew`]])
  })

  it('skips a merge already recorded without capturing again', () => {
    const { merge } = repositoryWithMerge()
    const outDir = repo.resolve('.hf', 'replay')
    const capture = jest.fn(() => SELECTION)
    const report = jest.fn((line: string) => line)
    replayMerges({ cwd: repo.path, ref: 'main', count: 10, outDir, capture, report: () => undefined })
    const second = replayMerges({ cwd: repo.path, ref: 'main', count: 10, outDir, capture, report })
    expect({ second, captures: capture.mock.calls.length, reported: report.mock.calls }).toEqual({
      second: [],
      captures: 1,
      reported: [[`${merge.slice(0, 12)} already recorded`]],
    })
  })
})
