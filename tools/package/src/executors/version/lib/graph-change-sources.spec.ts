import type { WorkspaceGraph } from '@hyperfrontend/workspace/graph'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { graphChangeSources, parseCommitFiles } from './graph-change-sources'

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
