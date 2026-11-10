import type { PlantedFixture } from './__test-utils__/workspace-fixtures'
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { fixtureNamed, plantFixture } from './__test-utils__/workspace-fixtures'
import { changeSet, DEFAULT_BASE, parseNameStatus, resolveBase } from './changes'

const planted: PlantedFixture[] = []

afterAll(() => {
  for (const fixture of planted.splice(0)) fixture.remove()
})

/**
 * Plants a fixture and remembers it for removal.
 *
 * @param name - The scenario's name
 * @returns The planted repository
 */
function plant(name: string): PlantedFixture {
  const fixture = plantFixture(fixtureNamed(name))
  planted.push(fixture)
  return fixture
}

describe('parseNameStatus', () => {
  it('reads every status, a rename with its previous path and a copy as an addition', () => {
    expect(parseNameStatus('A\0a\0M\0b\0D\0c\0R100\0d\0e\0C75\0f\0g\0T\0h\0X\0i\0')).toEqual([
      { status: 'added', path: 'a', previousPath: null },
      { status: 'modified', path: 'b', previousPath: null },
      { status: 'deleted', path: 'c', previousPath: null },
      { status: 'renamed', path: 'e', previousPath: 'd' },
      { status: 'added', path: 'g', previousPath: null },
      { status: 'modified', path: 'h', previousPath: null },
      { status: 'modified', path: 'i', previousPath: null },
    ])
  })
})

describe('resolveBase', () => {
  const unborn = useTempDir({ prefix: 'resolve-base-' })

  it('answers a revision the repository has', () => {
    const { root, head } = plant('renamed-module')
    expect(resolveBase(root, head)).toBe(head)
  })

  it('compares with main when the default base is asked for and the repository has no origin/main', () => {
    expect(resolveBase(plant('renamed-module').root, DEFAULT_BASE)).toBe('main')
  })

  it('answers null for a revision the repository does not have', () => {
    expect(resolveBase(plant('renamed-module').root, 'v9.9.9')).toBeNull()
  })

  it('answers null for the default base in a repository with no commits', () => {
    execFileSync('git', ['init', '-q', '--initial-branch=main'], { cwd: unborn.path })
    expect(resolveBase(unborn.path, DEFAULT_BASE)).toBeNull()
  })
})

describe('changeSet', () => {
  it('lists the changes between two revisions with renames, sorted by path', () => {
    const { root, base, head } = plant('renamed-module')
    expect(changeSet(root, base, head)).toEqual({
      base,
      head,
      changes: [
        { status: 'renamed', path: 'libs/alpha/src/extra/extra-work.ts', previousPath: 'libs/alpha/src/extra/extra-impl.ts' },
        { status: 'modified', path: 'libs/alpha/src/extra/index.ts', previousPath: null },
      ],
    })
  })

  it('compares from the merge base, so a base ahead of the head adds nothing', () => {
    const { root, base, head } = plant('unused-entry-edit')
    expect(changeSet(root, head, base).changes).toEqual([])
  })

  it('reads the working tree with its dirty and untracked files when no head is given', () => {
    const { root, base } = plant('unused-entry-edit')
    writeFileSync(join(root, 'libs/alpha/src/types.ts'), 'export interface AlphaOptions {\n  level: string\n}\n')
    writeFileSync(join(root, 'libs/alpha/src/untracked.ts'), 'export const untracked = 1\n')
    expect(changeSet(root, base, null)).toEqual({
      base,
      head: null,
      changes: [
        { status: 'modified', path: 'libs/alpha/src/core.ts', previousPath: null },
        { status: 'modified', path: 'libs/alpha/src/types.ts', previousPath: null },
        { status: 'added', path: 'libs/alpha/src/untracked.ts', previousPath: null },
      ],
    })
  })

  it('leaves out what .hfignore names', () => {
    const { root, base } = plant('root-input-edit')
    writeFileSync(join(root, '.hfignore'), 'docs/**\n.hfignore\n')
    execFileSync('git', ['add', '.hfignore'], { cwd: root })
    expect(changeSet(root, base, null).changes).toEqual([])
  })
})
