import type { PlantedFixture } from './workspace-fixtures'
import { execFileSync } from 'node:child_process'
import { after as afterAll } from 'node:test'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { FIXTURE_WORKSPACE, FIXTURES, fixtureNamed, plantFixture } from './workspace-fixtures'

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

/**
 * Runs git in a planted repository.
 *
 * @param root - The repository root
 * @param args - The arguments after `git`
 * @returns The output's lines, sorted
 */
function gitLines(root: string, args: readonly string[]): string[] {
  return execFileSync('git', [...args], { cwd: root, encoding: 'utf8' })
    .trim()
    .split(/\r?\n/)
    .sort()
}

describe('plantFixture', () => {
  it('commits the base tree as the first commit', () => {
    const { root, base } = plant('unused-entry-edit')
    expect(gitLines(root, ['ls-tree', '-r', '--name-only', base])).toEqual(keys(FIXTURE_WORKSPACE).sort())
  })

  it('writes the head tree as the second commit', () => {
    const { root, base, head } = plant('renamed-module')
    expect(gitLines(root, ['rev-list', '--count', `${base}..${head}`])).toEqual(['1'])
  })

  it('removes the repository on request', () => {
    const fixture = plantFixture(fixtureNamed('deleted-project-file'))
    fixture.remove()
    expect(() => execFileSync('git', ['status'], { cwd: fixture.root, stdio: 'ignore' })).toThrow()
  })
})

describe('FIXTURES', () => {
  it.each(FIXTURES.map((fixture) => [fixture.name, fixture.expectedChanges] as const))(
    '%s changes exactly what it describes',
    (name, expectedChanges) => {
      const { root, base, head } = plant(name)
      expect(gitLines(root, ['diff', '--name-status', '-M', base, head])).toEqual([...expectedChanges].sort())
    }
  )

  it('names every scenario once', () => {
    const names = FIXTURES.map((fixture) => fixture.name)
    expect(names.filter((name, index) => names.indexOf(name) !== index)).toEqual([])
  })
})

describe('fixtureNamed', () => {
  it('rejects an unknown name', () => {
    expect(() => fixtureNamed('nothing')).toThrow('no fixture named nothing')
  })
})
