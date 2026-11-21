import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { fullyStaged, gitIn, restage } from './staged'

describe('the files a step may stage again', () => {
  const dir = useTempDir({ tree: { 'a.ts': 'a\n', 'b.ts': 'b\n', 'c.ts': 'c\n', 'odd [name].ts': 'odd\n' } })

  /**
   * Makes the directory a repository with a.ts, b.ts and the oddly named file staged, and b.ts
   * edited since.
   *
   * @returns Runs git in the repository
   */
  function repository(): ReturnType<typeof gitIn> {
    execFileSync('git', ['init', '-q'], { cwd: dir.path })
    const git = gitIn(dir.path)
    git(['add', 'a.ts', 'b.ts', 'odd [name].ts'])
    writeFileSync(join(dir.path, 'b.ts'), 'b, edited after staging\n')
    return git
  }

  it('lists the staged files that have no unstaged change', () => {
    expect(fullyStaged(repository())).toEqual(['a.ts', 'odd [name].ts'])
  })

  it('stages again the fully staged files that changed since', () => {
    const git = repository()
    const before = fullyStaged(git)
    writeFileSync(join(dir.path, 'a.ts'), 'a, fixed\n')
    writeFileSync(join(dir.path, 'odd [name].ts'), 'odd, fixed\n')
    expect(restage(git, before)).toEqual(['a.ts', 'odd [name].ts'])
  })

  it('puts the fixed content in the index', () => {
    const git = repository()
    const before = fullyStaged(git)
    writeFileSync(join(dir.path, 'a.ts'), 'a, fixed\n')
    restage(git, before)
    expect(git(['show', ':a.ts'])).toBe('a, fixed\n')
  })

  it('leaves a file with unstaged content of its own as it was staged', () => {
    const git = repository()
    restage(git, fullyStaged(git))
    expect(git(['show', ':b.ts'])).toBe('b\n')
  })

  it('stages nothing when no fully staged file changed', () => {
    const git = repository()
    expect(restage(git, fullyStaged(git))).toEqual([])
  })
})
