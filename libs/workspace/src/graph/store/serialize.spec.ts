import type { ProjectRecord } from '../model'
import { createHash } from 'node:crypto'
import { rmSync } from 'node:fs'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createGraphWorkspace } from '../__test-utils__/workspace'
import { entryClosures } from '../affected/closure'
import { workspaceGraph } from '../build'
import { hashesByPath, listFileRecords } from './files'
import { entriesBody, graphBody, importsBody, printableProject } from './serialize'

const root = createGraphWorkspace()
const graph = workspaceGraph(root)
const hashes = hashesByPath(listFileRecords(root))

describe('printableProject', () => {
  it('keeps the record without its manifest and configuration', () => {
    const project = graph.projects.get('lib-a') as ProjectRecord
    expect(keys(printableProject(project))).toEqual(['name', 'root', 'type', 'tags', 'implicitDependencies', 'files'])
  })
})

describe('graphBody', () => {
  it('lists the projects by name and the project edges under each', () => {
    const body = graphBody(graph)
    expect({ projects: body.projects.map((project) => project.name), edges: keys(body.edges) }).toEqual({
      projects: ['@fixture/app', '@fixture/b', '@fixture/c', 'lib-a', 'lib-d', 'root', 'tooling'],
      edges: ['@fixture/app', '@fixture/b', '@fixture/c', 'lib-a', 'lib-d', 'root', 'tooling'],
    })
  })

  it('sorts the nodes by id and keeps the records as the graph orders them', () => {
    const body = graphBody(graph)
    const ids = body.nodes.map(
      (node) => `${node.kind}:${'path' in node ? node.path : 'name' in node ? node.name : 'id' in node ? node.id : ''}`
    )
    expect({ sorted: ids.every((id, index) => index === 0 || (ids[index - 1] as string) <= id), records: body.records }).toEqual({
      sorted: true,
      records: graph.records,
    })
  })
})

describe('importsBody', () => {
  it('records the code files alone, each with its hash, null for a file the parser cannot read', () => {
    const body = importsBody(graph.imports, hashes)
    expect({
      readme: 'apps/app/README.md' in body,
      broken: body['apps/app/src/broken.ts'],
      main: body['apps/app/src/main.ts']?.hash,
    }).toEqual({
      readme: false,
      broken: { hash: hashes.get('apps/app/src/broken.ts'), imports: null },
      main: hashes.get('apps/app/src/main.ts'),
    })
  })

  it('leaves out a code file the listing does not hash', () => {
    expect('libs/a/src/index.ts' in importsBody(graph.imports, createMap())).toBe(false)
  })

  it('sorts the records by path', () => {
    const paths = keys(importsBody(graph.imports, hashes))
    expect(paths).toEqual([...paths].sort())
  })
})

describe('entriesBody', () => {
  it('records each entry with its file, project and sorted reachable files, a cycle counted whole', () => {
    const body = entriesBody(graph, hashes)
    expect(body['@fixture/b']).toEqual({
      file: 'libs/b/src/index.ts',
      project: '@fixture/b',
      files: [
        'libs/a/package.json',
        'libs/a/project.json',
        'libs/a/src/deep.ts',
        'libs/a/src/index.ts',
        'libs/b/package.json',
        'libs/b/src/index.ts',
        'libs/b/src/side.ts',
      ],
      digest: expect.any(String),
    })
  })

  it('digests the path and hash lines of the reachable files', () => {
    const closure = entryClosures(graph).get('@fixture/c')
    const files = [...(closure?.files.keys() ?? [])].sort()
    const expected = createHash('sha256')
      .update(files.map((file) => `${file} ${hashes.get(file)}`).join('\n'))
      .digest('hex')
    expect(entriesBody(graph, hashes)['@fixture/c']?.digest).toBe(expected)
  })

  it('sorts the entries by id', () => {
    const ids = keys(entriesBody(graph, hashes))
    expect(ids).toEqual([...ids].sort())
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(graph.projects.size).toBe(7)
  })
})
