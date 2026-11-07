import { execFileSync } from 'node:child_process'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { baseBranches, listRemotes } from './base-branch'

const dir = useTempDir()

describe('baseBranches', () => {
  it('reads the branch behind a remote-tracking base', () => {
    expect(baseBranches('origin/main', ['origin'])).toEqual(['origin/main', 'main'])
  })

  it('keeps a slash in a branch name that no remote owns', () => {
    expect(baseBranches('release/2.x', ['origin'])).toEqual(['release/2.x'])
  })

  it('strips a full remote ref', () => {
    expect(baseBranches('refs/remotes/upstream/trunk', ['origin', 'upstream'])).toEqual([
      'refs/remotes/upstream/trunk',
      'upstream/trunk',
      'trunk',
    ])
  })

  it('strips a full local ref', () => {
    expect(baseBranches('refs/heads/main', [])).toEqual(['refs/heads/main', 'main'])
  })

  it('names a plain branch once', () => {
    expect(baseBranches('main', ['origin'])).toEqual(['main'])
  })
})

describe('listRemotes', () => {
  it('names the remotes of the repository', () => {
    execFileSync('git', ['init', '--quiet'], { cwd: dir.path })
    execFileSync('git', ['remote', 'add', 'origin', 'https://example.com/a.git'], { cwd: dir.path })
    execFileSync('git', ['remote', 'add', 'upstream', 'https://example.com/b.git'], { cwd: dir.path })
    expect(listRemotes(dir.path)).toEqual(['origin', 'upstream'])
  })

  it('names none outside a repository', () => {
    expect(listRemotes(dir.resolve('nowhere'))).toEqual([])
  })
})
