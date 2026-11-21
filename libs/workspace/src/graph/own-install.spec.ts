import type { ProjectRecord } from './model'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createConsumerWorkspace, REGISTRY_PACKAGES } from './__test-utils__/consumer-workspace'
import { registryPackages } from './own-install'
import { discoverProjects, listFiles } from './workspace'

const root = createConsumerWorkspace()
const files = createSet(listFiles(root))
const projects = discoverProjects(root, [...files])
// why: the file list still names a configuration the working tree has since lost
rmSync(join(root, 'apps/deleted/tsconfig.json'))

/**
 * The packages a project of the workspace takes from a registry.
 *
 * @param name - The project's name
 * @returns The package names, in the order its lock file lists them
 */
function taken(name: string): string[] {
  return [...registryPackages(root, files, projects.get(name) as ProjectRecord)]
}

describe('registryPackages', () => {
  it.each([
    ['configurations that extend a package and one another, comments and all', 'site'],
    ['an extends found past a member the reader cannot name', 'spread'],
    ['no configuration at all', 'bare'],
    ['a manifest and nothing else', '@fixture/lone'],
  ])('answers what the lock file takes from a registry for a project with %s', (_title, name) => {
    expect(taken(name)).toEqual(REGISTRY_PACKAGES)
  })

  it.each([
    ['the workspace root, whose files run under the aliases', 'root'],
    ['a project without a lock file', 'lib-kit'],
    ['a configuration extending the base', 'seed'],
    ['a chain of configurations reaching the base', 'chain'],
    ['an extends naming a file the workspace lacks', 'missing'],
    ['an extends naming an absolute path', 'absolute'],
    ['an extends naming a path on a drive', 'drive'],
    ['a configuration that does not parse', 'broken'],
    ['a configuration that is no object', 'list'],
    ['an extends that names no path', 'numbered'],
    ['an extends with a hole in its list', 'holed'],
    ['a configuration the working tree has deleted', 'deleted'],
    ['a target the engine tests', 'checked'],
    ['a target the engine runs end to end', 'packed'],
  ])('answers none for %s', (_title, name) => {
    expect(taken(name)).toEqual([])
  })

  it('answers with the same set when asked again', () => {
    const site = projects.get('site') as ProjectRecord
    expect(registryPackages(root, files, site)).toBe(registryPackages(root, files, site))
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
