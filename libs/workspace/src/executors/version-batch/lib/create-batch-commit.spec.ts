import { execFileSync } from 'node:child_process'
import { chmodSync } from 'node:fs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { createBatchCommit } from './create-batch-commit'

const repository = useTempDir({
  prefix: 'batch-commit-',
  tree: { 'libs/a/package.json': '{ "version": "1.0.0" }\n', 'libs/b/package.json': '{ "version": "2.0.0" }\n' },
})

/**
 * Runs git in the temporary repository.
 *
 * @param args - The git arguments
 * @returns What git printed, trimmed
 */
function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: repository.path, encoding: 'utf8' }).trim()
}

/**
 * Turns the temporary directory into a repository with one commit, whose identity is its own,
 * and bumps both manifests without staging them.
 */
function bumpedRepository(): void {
  git('init', '-q')
  git('config', 'user.name', 'fixture')
  git('config', 'user.email', 'fixture@localhost')
  git('config', 'commit.gpgsign', 'false')
  git('add', '-A')
  git('commit', '-q', '-m', 'base')
  repository.write('libs/a/package.json', '{ "version": "1.0.1" }\n')
  repository.write('libs/b/package.json', '{ "version": "2.0.1" }\n')
}

describe('createBatchCommit', () => {
  it('refuses a commit of no files', async () => {
    await expect(createBatchCommit(repository.path, [], ['lib-a'])).rejects.toThrow('No files to commit')
  })

  it('refuses a commit that names no libraries', async () => {
    await expect(createBatchCommit(repository.path, ['libs/a/package.json'], [])).rejects.toThrow(
      'No libraries to include in commit message'
    )
  })

  it('fails when git cannot stage a file', async () => {
    bumpedRepository()
    await expect(createBatchCommit(repository.path, ['libs/missing/package.json'], ['lib-a'])).rejects.toThrow(
      'Failed to stage files for commit'
    )
  })

  it('answers the hash of the commit it made', async () => {
    bumpedRepository()
    const hash = await createBatchCommit(repository.path, ['libs/a/package.json'], ['lib-a'])
    expect(hash).toBe(git('rev-parse', 'HEAD'))
  })

  it('names every library in the subject, in the order given, however long the list', async () => {
    bumpedRepository()
    const libraries = Array.from({ length: 12 }, (_, index) => `lib-with-a-long-name-${index}`)
    await createBatchCommit(repository.path, ['libs/a/package.json'], libraries)
    expect(git('log', '-1', '--format=%B')).toBe(`chore: update versions for ${libraries.join(', ')}`)
  })

  it('commits the files it is given, and leaves every other edit uncommitted', async () => {
    bumpedRepository()
    await createBatchCommit(repository.path, ['libs/a/package.json'], ['lib-a'])
    expect({
      committed: git('show', '--name-only', '--format=', 'HEAD'),
      uncommitted: git('status', '--porcelain'),
    }).toEqual({
      committed: 'libs/a/package.json',
      uncommitted: 'M libs/b/package.json',
    })
  })

  it('commits past a pre-commit hook that would refuse', async () => {
    bumpedRepository()
    chmodSync(repository.write('.git/hooks/pre-commit', '#!/bin/sh\nexit 1\n'), 0o755)
    const hash = await createBatchCommit(repository.path, ['libs/a/package.json'], ['lib-a'])
    expect(hash).toBe(git('rev-parse', 'HEAD'))
  })
})
