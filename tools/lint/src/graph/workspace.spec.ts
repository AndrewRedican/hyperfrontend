import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createGraphWorkspace } from './__test-utils__/workspace.ts'
import { discoverProjects, listFiles, readJson } from './workspace.ts'

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
    expect([...projects.keys()].sort()).toEqual(['@fixture/app', '@fixture/b', '@fixture/c', 'lib-a', 'root'])
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

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
