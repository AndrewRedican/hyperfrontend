import type { ProjectRecord } from './model'
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { createGraphWorkspace } from './__test-utils__/workspace'
import { discoverProjects, hasTarget, listFiles, readAliases, readJson } from './workspace'

const root = createGraphWorkspace()

describe('listFiles', () => {
  it('lists the files git knows, less the ignored', () => {
    const files = listFiles(root)
    expect(
      files.includes('libs/a/src/index.ts') &&
        !files.includes('ignored/package.json') &&
        !files.includes('node_modules/left-pad/package.json')
    ).toBe(true)
  })

  it('lists every file when there is no .nxignore', () => {
    rmSync(join(root, '.nxignore'))
    const files = listFiles(root)
    writeFileSync(join(root, '.nxignore'), 'ignored/**\n')
    expect(files.includes('ignored/package.json')).toBe(true)
  })
})

describe('readJson', () => {
  it('answers null for a missing file', () => {
    expect(readJson(join(root, 'nope.json'))).toBe(null)
  })

  it('answers null for a file that does not parse', () => {
    expect(readJson(join(root, 'apps/app/README.md'))).toBe(null)
  })
})

describe('discoverProjects', () => {
  it('finds the projects by configuration and manifest', () => {
    const projects = discoverProjects(root, listFiles(root))
    expect([...projects.keys()].sort()).toEqual(['@fixture/app', '@fixture/b', '@fixture/c', 'lib-a', 'lib-d', 'root', 'tooling'])
  })

  it('reads the type, tags and implicit dependencies', () => {
    const project = discoverProjects(root, listFiles(root)).get('lib-a')
    expect([project?.type, project?.tags, project?.implicitDependencies]).toEqual(['lib', ['npm:public', 'npm:util', 'scope:a'], ['lib-b']])
  })

  it('reads a manifest-only library through its nx field without tags', () => {
    const project = discoverProjects(root, listFiles(root)).get('@fixture/b')
    expect([project?.type, project?.tags, project?.root]).toEqual(['lib', [], 'libs/b'])
  })

  it('reads a manifest-only project elsewhere as a library', () => {
    expect(discoverProjects(root, listFiles(root)).get('@fixture/c')?.type).toBe('lib')
  })

  it('reads a manifest-only project under apps as an application', () => {
    const project = discoverProjects(root, listFiles(root)).get('@fixture/app')
    expect([project?.type, project?.files.includes('apps/app/README.md')]).toEqual(['app', true])
  })

  it('leaves unassigned the files no project owns', () => {
    const files = listFiles(root).filter((file) => file !== 'project.json' && file !== 'package.json')
    expect(discoverProjects(root, files).has('root')).toBe(false)
  })

  it('infers a lint target for a project that declares none, running the linter from its root', () => {
    expect(discoverProjects(root, listFiles(root)).get('@fixture/b')?.configuration?.targets?.['lint']).toEqual({
      executor: 'nx:run-commands',
      options: { command: 'node ../../tools/lint/bin/lint.ts .', cwd: 'libs/b' },
    })
  })

  it('leaves a declared lint target as it is', () => {
    expect(discoverProjects(root, listFiles(root)).get('lib-a')?.configuration?.targets?.['lint']).toEqual({})
  })

  it('infers no lint target for the workspace root', () => {
    expect(discoverProjects(root, listFiles(root)).get('root')?.configuration?.targets?.['lint']).toBeUndefined()
  })

  it('infers no lint target for a project the plugin entry excludes', () => {
    const excluded = createTempDir({
      prefix: 'lint-infer-',
      tree: {
        'nx.json': '{ "plugins": ["./other.ts", { "plugin": "./tools/lint/src/nx/plugin.ts", "exclude": ["apps/demos/**/*"] }] }',
        'apps/demos/one/project.json': '{ "name": "demo-one" }',
        'libs/two/package.json': '{ "name": "@fixture/two" }',
      },
    })
    const projects = discoverProjects(excluded.path, ['nx.json', 'apps/demos/one/project.json', 'libs/two/package.json'])
    expect([
      hasTarget(projects.get('demo-one') as ProjectRecord, 'lint'),
      hasTarget(projects.get('@fixture/two') as ProjectRecord, 'lint'),
    ]).toEqual([false, true])
  })

  it('gives the root project the files no other owns', () => {
    const project = discoverProjects(root, listFiles(root)).get('root')
    expect([
      project?.type,
      project?.tags,
      project?.files.includes('lint.config.ts'),
      project?.files.includes('libs/a/src/index.ts'),
    ]).toEqual(['app', ['npm:private', 'scope:root'], true, false])
  })
})

describe('readAliases', () => {
  it('reads the path aliases of the base tsconfig', () => {
    expect(readAliases(root).get('@fixture/a')).toEqual(['libs/a/src/index.ts'])
  })

  it('reads none without a base tsconfig', () => {
    expect(readAliases(join(root, 'libs')).size).toBe(0)
  })
})

describe('hasTarget', () => {
  it('answers whether the configuration declares the target', () => {
    const projects = discoverProjects(root, listFiles(root))
    const [a, b] = [projects.get('lib-a') as ProjectRecord, projects.get('@fixture/b') as ProjectRecord]
    expect([hasTarget(a, 'version'), hasTarget(a, 'serve'), hasTarget(b, 'version')]).toEqual([true, false, false])
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
