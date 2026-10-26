import type { ProjectRecord } from './model'
import { existsSync, rmSync } from 'node:fs'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createGraphWorkspace } from './__test-utils__/workspace'
import { entriesOfProject, exportTarget } from './entries'
import { discoverProjects, listFiles, readAliases } from './workspace'

const root = createGraphWorkspace()
const fileList = listFiles(root)
const files = createSet(fileList)
const projects = discoverProjects(root, fileList)
const aliases = readAliases(root)

/**
 * The entries of a project, compactly.
 *
 * @param name - The project's name
 * @returns One `id=file` per entry
 */
function entriesOf(name: string): string[] {
  return entriesOfProject(projects.get(name) as ProjectRecord, aliases, files).map((entry) => `${entry.id}=${entry.file}`)
}

describe('exportTarget', () => {
  it('answers a string, the first condition of an object, nested conditions, and null for anything else', () => {
    expect([
      exportTarget('./a.js'),
      exportTarget({ types: './a.d.ts', import: './a.mjs', require: './a.cjs' }),
      exportTarget({ node: { default: './node.js' }, default: { import: './b.js' } }),
      exportTarget({ browser: './c.js' }),
      exportTarget(null),
      exportTarget(3),
    ]).toEqual(['./a.js', './a.mjs', './b.js', null, null, null])
  })
})

describe('entriesOfProject', () => {
  it('reads the export subpaths, leaving out the manifest, patterns and subpaths naming no file', () => {
    expect(entriesOf('@fixture/b')).toEqual(['@fixture/b=libs/b/src/index.ts', '@fixture/b/side=libs/b/src/side.ts'])
  })

  it('reads the aliases naming the package, leaving out wildcards and aliases naming no file', () => {
    expect(entriesOf('lib-a')).toEqual(['@fixture/a=libs/a/src/index.ts'])
  })

  it('reads a string exports field and a conditions object as the main entry', () => {
    expect([...entriesOf('@fixture/app'), ...entriesOf('@fixture/c')]).toEqual([
      '@fixture/app=apps/app/src/main.ts',
      '@fixture/c=libs/c/index.ts',
    ])
  })

  it('reads none for a project without exports or aliases, or without a manifest', () => {
    const bare: ProjectRecord = { ...(projects.get('tooling') as ProjectRecord), manifest: null }
    expect([entriesOf('tooling'), entriesOf('root'), entriesOfProject(bare, aliases, files)]).toEqual([[], [], []])
  })

  it('lets the alias win over the export for the same entry', () => {
    const own = createMap([['@fixture/b', ['libs/b/src/side.ts']]])
    expect(entriesOfProject(projects.get('@fixture/b') as ProjectRecord, own, files).map((entry) => `${entry.id}=${entry.file}`)).toEqual([
      '@fixture/b=libs/b/src/side.ts',
      '@fixture/b/side=libs/b/src/side.ts',
    ])
  })

  it('accepts an alias anywhere in the workspace for the root project', () => {
    const own = createMap([['@fixture/workspace', ['lint.config.ts']]])
    expect(entriesOfProject(projects.get('root') as ProjectRecord, own, files)).toEqual([
      { kind: 'entry', id: '@fixture/workspace', project: 'root', file: 'lint.config.ts' },
    ])
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
