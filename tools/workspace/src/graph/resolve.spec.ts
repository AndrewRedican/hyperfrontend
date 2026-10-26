import type { Resolver } from './resolve'
import { existsSync, rmSync } from 'node:fs'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { compileGlob } from '@hyperfrontend/linter/helpers'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createGraphWorkspace } from './__test-utils__/workspace'
import { entriesOfProject } from './entries'
import { fileOf, packageNameOf, packagesOf, projectOfFile, resolveSpecifier, substituteWildcard } from './resolve'
import { discoverProjects, listFiles } from './workspace'

const root = createGraphWorkspace()
let resolver: Resolver

{
  const files = listFiles(root)
  const projects = discoverProjects(root, files)
  const aliases = createMap([
    ['@fixture/a', ['libs/a/src/index.ts']],
    ['@fixture/a/*', ['libs/a/src/*']],
    ['@fixture/none', []],
    ['@fixture/star/*', []],
  ])
  const fileSet = createSet(files)
  resolver = {
    root,
    files: fileSet,
    projects,
    aliases,
    packages: packagesOf([compileGlob('libs/*')], projects),
    entries: createMap(
      [...projects.values()].flatMap((project) => entriesOfProject(project, aliases, fileSet)).map((entry) => [entry.id, entry])
    ),
  }
}

/**
 * A resolution's kind and the project or name it carries.
 *
 * @param from - The importing file
 * @param specifier - The specifier resolved
 * @returns A compact label
 */
function label(from: string, specifier: string): string {
  const resolution = resolveSpecifier(resolver, from, specifier)
  if (resolution.kind === 'project') return `project ${resolution.project.name} ${resolution.file}`
  if (resolution.kind === 'npm') return `npm ${resolution.name}`
  return resolution.kind
}

describe('fileOf', () => {
  it('answers an existing path as is', () => {
    expect(fileOf(resolver.files, 'libs/a/src/index.ts')).toBe('libs/a/src/index.ts')
  })

  it('supplies an extension or an index file', () => {
    expect([fileOf(resolver.files, 'libs/a/src/deep'), fileOf(resolver.files, 'libs/a/src')]).toEqual([
      'libs/a/src/deep.ts',
      'libs/a/src/index.ts',
    ])
  })

  it('swaps an emitted extension for the source', () => {
    expect([
      fileOf(resolver.files, 'libs/a/src/deep.js'),
      fileOf(resolver.files, 'libs/a/src/deep.mjs'),
      fileOf(resolver.files, 'libs/a/src/x.js'),
    ]).toEqual(['libs/a/src/deep.ts', null, null])
  })
})

describe('substituteWildcard', () => {
  it('puts the value in place of the first wildcard, taken literally', () => {
    expect([
      substituteWildcard('libs/a/src/*.ts', 'deep'),
      substituteWildcard('libs/*/*', "$&'"),
      substituteWildcard('libs/a', 'deep'),
    ]).toEqual(['libs/a/src/deep.ts', "libs/$&'/*", 'libs/a'])
  })
})

describe('projectOfFile', () => {
  it('answers the deepest owner, the root last', () => {
    expect([
      projectOfFile(resolver.projects, 'libs/a/src/index.ts')?.name,
      projectOfFile(resolver.projects, 'lint.config.ts')?.name,
    ]).toEqual(['lib-a', 'root'])
  })

  it('answers null without a root project', () => {
    const projects = createMap([...resolver.projects].filter(([name]) => name !== 'root'))
    expect(projectOfFile(projects, 'lint.config.ts')).toBe(null)
  })
})

describe('packagesOf', () => {
  it('keeps the packages the workspaces globs cover', () => {
    expect([...resolver.packages.keys()]).toEqual(['@fixture/a', '@fixture/b', '@fixture/c'])
  })

  it('keeps nothing without workspaces', () => {
    expect(packagesOf([], resolver.projects).size).toBe(0)
  })
})

describe('packageNameOf', () => {
  it('takes the first segment, or two for a scope', () => {
    expect([packageNameOf('left-pad/lib'), packageNameOf('@fixture/a/deep')]).toEqual(['left-pad', '@fixture/a'])
  })
})

describe('resolveSpecifier', () => {
  it('answers builtins', () => {
    expect([label('libs/a/src/deep.ts', 'node:fs'), label('libs/a/src/deep.ts', 'fs')]).toEqual(['builtin', 'builtin'])
  })

  it('answers relative paths by the project holding them', () => {
    expect([
      label('libs/a/src/deep.ts', '../../b/src/index'),
      label('libs/a/src/deep.ts', '../../../package.json'),
      label('libs/a/src/deep.ts', './gone'),
    ]).toEqual(['project @fixture/b libs/b/src/index.ts', 'project root package.json', 'project lib-a null'])
  })

  it('answers aliases, exact and wildcard', () => {
    expect([
      label('apps/app/src/main.ts', '@fixture/a'),
      label('apps/app/src/main.ts', '@fixture/a/deep'),
      label('apps/app/src/main.ts', '@fixture/none'),
    ]).toEqual(['project lib-a libs/a/src/index.ts', 'project lib-a libs/a/src/deep.ts', 'npm @fixture/none'])
  })

  it('falls through a wildcard alias without targets', () => {
    expect(label('apps/app/src/main.ts', '@fixture/star/x')).toBe('npm @fixture/star')
  })

  it('falls through an alias whose target no project holds', () => {
    const projects = createMap([...resolver.projects].filter(([name]) => name !== 'root'))
    const aliases = createMap([['outside', ['elsewhere/index.ts']]])
    expect(resolveSpecifier({ ...resolver, projects, aliases }, 'libs/a/src/deep.ts', 'outside').kind).toBe('npm')
  })

  it('answers workspace packages and npm packages', () => {
    expect([
      label('libs/b/src/index.spec.ts', '@fixture/b'),
      label('libs/a/src/deep.ts', 'left-pad'),
      label('libs/a/src/deep.ts', 'missing-package'),
    ]).toEqual(['project @fixture/b libs/b/src/index.ts', 'npm left-pad', 'npm missing-package'])
  })

  it('answers a workspace package subpath by its entry, and null for a subpath without one', () => {
    expect([label('libs/a/src/deep.ts', '@fixture/b/side'), label('libs/a/src/deep.ts', '@fixture/b/missing')]).toEqual([
      'project @fixture/b libs/b/src/side.ts',
      'project @fixture/b null',
    ])
  })

  it('carries the path a relative or aliased specifier named, and none for a package name', () => {
    const paths = ['./gone', '@fixture/a/deep', '@fixture/b'].map((specifier) => {
      const resolution = resolveSpecifier(resolver, 'libs/a/src/deep.ts', specifier)
      return resolution.kind === 'project' ? resolution.path : resolution.kind
    })
    expect(paths).toEqual(['libs/a/src/gone', 'libs/a/src/deep', null])
  })

  it('answers an installed workspace package as npm', () => {
    expect(label('libs/a/src/deep.ts', '@fixture/c')).toBe('npm @fixture/c')
  })

  it('answers unknown for a path outside every project', () => {
    const projects = createMap([...resolver.projects].filter(([name]) => name !== 'root'))
    expect(resolveSpecifier({ ...resolver, projects }, 'libs/a/src/deep.ts', '../../../lint.config')).toEqual({
      kind: 'unknown',
      path: 'lint.config',
    })
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
