import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { createGraphWorkspace } from '../__test-utils__/workspace'
import { readerVersion } from '../imports'
import { listFileRecords } from './files'
import { sourcesHash } from './hashes'
import { algorithmVersion, currentMeta, metaDifferences, SCHEMA } from './meta'

const root = createGraphWorkspace()

describe('currentMeta', () => {
  it('records the schema, the algorithm, the reader, the Node major and the hash of each global configuration file', () => {
    const files = listFileRecords(root)
    const hash = (path: string): string | null => files.find((record) => record.path === path)?.hash ?? null
    expect(currentMeta(root, files)).toEqual({
      schema: SCHEMA,
      algorithm: 'installed',
      reader: readerVersion(root),
      node: process.versions.node.split('.')[0],
      config: {
        'nx.json': hash('nx.json'),
        'package.json': hash('package.json'),
        'package-lock.json': hash('package-lock.json'),
        'tsconfig.base.json': hash('tsconfig.base.json'),
      },
    })
  })

  it('records null for a configuration file the workspace lacks', () => {
    expect(currentMeta(root, []).config).toEqual({
      'nx.json': null,
      'package.json': null,
      'package-lock.json': null,
      'tsconfig.base.json': null,
    })
  })
})

describe('algorithmVersion', () => {
  it('hashes the graph sources where the workspace aliases the graph package to its source', () => {
    const aliased = createTempDir({
      prefix: 'algorithm-',
      tree: {
        'tsconfig.base.json':
          '{ "compilerOptions": { "paths": { "@hyperfrontend/workspace/graph": ["tools/workspace/src/graph/index.ts"] } } }',
        'tools/workspace/src/graph/index.ts': 'export const graph = 1\n',
        'tools/workspace/src/graph/build.ts': 'export const build = 1\n',
      },
    })
    try {
      expect(algorithmVersion(aliased.path)).toBe(sourcesHash(join(aliased.path, 'tools/workspace/src/graph')))
    } finally {
      aliased.remove()
    }
  })

  it('answers installed where the alias names no sources', () => {
    const dangling = createTempDir({
      prefix: 'algorithm-',
      tree: { 'tsconfig.base.json': '{ "compilerOptions": { "paths": { "@hyperfrontend/workspace/graph": ["gone/index.ts"] } } }' },
    })
    try {
      expect(algorithmVersion(dangling.path)).toBe('installed')
    } finally {
      dangling.remove()
    }
  })
})

describe('metaDifferences', () => {
  it('names the differing keys, configuration files prefixed', () => {
    const meta = currentMeta(root, listFileRecords(root))
    const other = { ...meta, reader: 'other', node: '0', config: { ...meta.config, 'nx.json': 'changed', 'package-lock.json': null } }
    expect(metaDifferences(meta, other)).toEqual(['reader', 'node', 'config:nx.json', 'config:package-lock.json'])
  })

  it('answers nothing for equal metas', () => {
    const meta = currentMeta(root, listFileRecords(root))
    expect(metaDifferences(meta, { ...meta })).toEqual([])
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(SCHEMA).toBe('hf-graph/1')
  })
})
