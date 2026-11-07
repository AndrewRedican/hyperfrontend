import type { PlantedFixture } from './__test-utils__/workspace-fixtures'
import { execFileSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it } from '@hyperfrontend/testing'
import { fixtureNamed, plantFixture } from './__test-utils__/workspace-fixtures'
import { selectAffected } from './affected/select'
import { buildGraph } from './build'
import { changeSet } from './changes'
import { CACHE_FILE } from './imports'
import { graphAtRevision, previousGraph, withRevision } from './revision'

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
 * The worktrees a repository lists.
 *
 * @param root - The repository root
 * @returns The count of `worktree` lines
 */
function worktreeCount(root: string): number {
  return execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter((line) => line.startsWith('worktree ')).length
}

/**
 * Installs a package and an import cache in a planted repository, both left untracked.
 *
 * @param root - The repository root
 */
function install(root: string): void {
  mkdirSync(join(root, 'node_modules', 'left-pad'), { recursive: true })
  writeFileSync(join(root, 'node_modules', 'left-pad', 'package.json'), '{ "name": "left-pad" }')
  mkdirSync(join(root, CACHE_FILE, '..'), { recursive: true })
  writeFileSync(join(root, CACHE_FILE), '{ "version": "remembered", "files": {} }')
}

describe('withRevision', () => {
  it('checks the revision out', () => {
    const { root, base } = plant('deleted-module')
    expect(withRevision(root, base, (checkout) => existsSync(join(checkout, 'libs/alpha/src/shared.ts')))).toBe(true)
  })

  it('removes the worktree when the work ends', () => {
    const { root, base } = plant('deleted-module')
    withRevision(root, base, () => null)
    expect(worktreeCount(root)).toBe(1)
  })

  it('removes the worktree when the work throws', () => {
    const { root, base } = plant('deleted-module')
    try {
      withRevision(root, base, () => {
        throw createError('work failed')
      })
    } catch {
      // why: the throw is the case under test; the count below is the assertion.
    }
    expect(worktreeCount(root)).toBe(1)
  })

  it('links the installed packages into the checkout', () => {
    const { root, base } = plant('deleted-module')
    install(root)
    expect(withRevision(root, base, (checkout) => lstatSync(join(checkout, 'node_modules', 'left-pad')).isSymbolicLink())).toBe(true)
  })

  it('copies the import cache rather than linking it', () => {
    const { root, base } = plant('deleted-module')
    install(root)
    expect(withRevision(root, base, (checkout) => readFileSync(join(checkout, CACHE_FILE), 'utf8'))).toContain('remembered')
  })

  it('links the packages without an import cache to copy', () => {
    const { root, base } = plant('deleted-module')
    mkdirSync(join(root, 'node_modules', 'left-pad'), { recursive: true })
    expect(withRevision(root, base, (checkout) => existsSync(join(checkout, CACHE_FILE)))).toBe(false)
  })
})

describe('graphAtRevision', () => {
  it('builds the graph as it stood at the revision', () => {
    const { root, base } = plant('deleted-module')
    expect(graphAtRevision(root, base).nodes.has('file:libs/alpha/src/shared.ts')).toBe(true)
  })
})

describe('previousGraph', () => {
  it('builds nothing for a selection of everything', () => {
    expect(previousGraph('/nowhere', null)).toBeUndefined()
  })

  it('builds nothing when no change removed a path', () => {
    expect(
      previousGraph('/nowhere', { base: 'b', head: null, changes: [{ status: 'modified', path: 'a.ts', previousPath: null }] })
    ).toBeUndefined()
  })

  it('builds the base graph for a renamed path', () => {
    const { root, base, head } = plant('renamed-module')
    expect(previousGraph(root, changeSet(root, base, head))?.nodes.has('file:libs/alpha/src/extra/extra-impl.ts')).toBe(true)
  })

  it('lets the selection report a module deleted with its importers', () => {
    const { root, base, head } = plant('deleted-module-rewired')
    const changes = changeSet(root, base, head)
    const set = selectAffected({ graph: buildGraph(root), changes, targets: ['build'], previous: previousGraph(root, changes) }).get(
      'build'
    )
    expect(set?.selected.find((decision) => decision.task === 'app-consumer:build')?.reasons.map((reason) => reason.rule)).toContain(
      'deleted-module'
    )
  })
})
