import type { Edge, GraphNode } from '../graph/model'
import type { GraphBody } from '../graph/store/serialize'
import { describe, expect, it } from '@hyperfrontend/testing'
import { explorerDocument } from './explorer'

/**
 * An edge drawn at a line of a file.
 *
 * @param source - The source node id
 * @param target - The target node id
 * @param kind - What produced the edge
 * @param role - The role of the source file
 * @param line - Where in the file
 * @returns The edge, with source evidence
 */
function edge(source: string, target: string, kind: Edge['kind'], role: Edge['role'], line: number): Edge {
  const file = source.slice('file:'.length)
  return {
    source,
    target,
    kind,
    role,
    path: { specifier: target, resolved: null },
    targets: [],
    evidence: { kind: 'source', file, line, column: 1 },
  }
}

/**
 * An edge a configuration key declared.
 *
 * @param source - The source node id
 * @param target - The target node id
 * @param kind - What produced the edge
 * @param role - The role of the configuration
 * @param file - The configuration file
 * @param key - The key within it
 * @returns The edge
 */
function declared(source: string, target: string, kind: Edge['kind'], role: Edge['role'], file: string, key: string): Edge {
  return { source, target, kind, role, path: null, targets: [], evidence: { kind: 'configuration', file, key } }
}

/** A graph of two libraries, two packages, two tools and one configuration. */
const BODY: GraphBody = {
  projects: [
    {
      name: 'lib-a',
      root: 'libs/a',
      type: 'lib',
      tags: ['type:util'],
      implicitDependencies: [],
      files: ['libs/a/src/index.ts', 'libs/a/src/a.spec.ts'],
    },
    { name: 'lib-b', root: 'libs/b', type: 'lib', tags: [], implicitDependencies: ['lib-a'], files: ['libs/b/src/index.ts'] },
  ],
  nodes: [
    { kind: 'project', name: 'lib-a', root: 'libs/a' },
    { kind: 'project', name: 'lib-b', root: 'libs/b' },
    { kind: 'file', path: 'libs/a/src/index.ts', project: 'lib-a', role: 'production' },
    { kind: 'file', path: 'libs/a/src/other.ts', project: 'lib-a', role: 'production' },
    { kind: 'file', path: 'libs/a/src/a.spec.ts', project: 'lib-a', role: 'spec' },
    { kind: 'file', path: 'libs/b/src/index.ts', project: 'lib-b', role: 'production' },
    { kind: 'file', path: 'stray.ts', project: null, role: 'script' },
    { kind: 'entry', id: '@scope/b', project: 'lib-b', file: 'libs/b/src/index.ts' },
    { kind: 'external', name: 'left-pad', version: '1.0.0' },
    { kind: 'external', name: 'right-pad', version: null },
    { kind: 'tool', id: '@hyperfrontend/package:test', project: 'tool-package', entry: null },
    { kind: 'tool', id: '@hyperfrontend/package:build', project: 'tool-package', entry: null },
    { kind: 'config', path: 'tsconfig.base.json' },
  ] as GraphNode[],
  records: [
    edge('file:libs/a/src/other.ts', 'entry:@scope/b', 'value', 'production', 1),
    edge('file:libs/a/src/index.ts', 'entry:@scope/b', 'value', 'production', 7),
    edge('file:libs/a/src/index.ts', 'entry:@scope/b', 'value', 'production', 3),
    edge('file:libs/a/src/index.ts', 'entry:@scope/b', 'value', 'production', 3),
    edge('file:libs/a/src/a.spec.ts', 'entry:@scope/b', 'value', 'spec', 2),
    edge('file:libs/a/src/a.spec.ts', 'entry:@scope/b', 'type', 'spec', 1),
    edge('file:libs/a/src/index.ts', 'file:libs/a/src/a.spec.ts', 'value', 'production', 9),
    edge('file:libs/a/src/index.ts', 'file:libs/b/src/index.ts', 'dynamic', 'production', 5),
    edge('file:libs/a/src/index.ts', 'external:left-pad@1.0.0', 'value', 'production', 2),
    edge('file:libs/a/src/index.ts', 'external:right-pad@*', 'value', 'production', 8),
    edge('file:stray.ts', 'entry:@scope/b', 'value', 'script', 1),
    edge('file:libs/a/src/index.ts', 'file:stray.ts', 'value', 'production', 4),
    declared('project:lib-b', 'project:lib-a', 'declared', 'build-config', 'libs/b/project.json', 'implicitDependencies'),
    declared('project:lib-a', 'tool:@hyperfrontend/package:build', 'tool', 'build-config', 'libs/a/project.json', 'targets.build.executor'),
    declared('project:lib-a', 'tool:@hyperfrontend/package:test', 'tool', 'test-config', 'nx.json', 'targetDefaults.test.executor'),
    declared('project:lib-a', 'config:tsconfig.base.json', 'config', 'build-config', 'nx.json', 'targetDefaults.build.inputs'),
    declared('project:lib-a', 'config:tsconfig.base.json', 'config', 'build-config', 'libs/a/project.json', 'targets.build.inputs'),
  ],
  edges: {},
}

describe('explorerDocument', () => {
  const document = explorerDocument(BODY, 'abc', 42)

  it('lists the projects with their file counts, the entries, and the nodes the links reach', () => {
    const { projects, entries, externals, tools, configs } = document
    expect({ projects, entries, externals, tools, configs }).toEqual({
      projects: [
        { name: 'lib-a', root: 'libs/a', type: 'lib', tags: ['type:util'], implicitDependencies: [], files: 2 },
        { name: 'lib-b', root: 'libs/b', type: 'lib', tags: [], implicitDependencies: ['lib-a'], files: 1 },
      ],
      entries: [{ id: '@scope/b', project: 'lib-b' }],
      externals: [
        { name: 'left-pad', version: '1.0.0' },
        { name: 'right-pad', version: null },
      ],
      tools: [
        { id: '@hyperfrontend/package:build', project: 'tool-package' },
        { id: '@hyperfrontend/package:test', project: 'tool-package' },
      ],
      configs: ['tsconfig.base.json'],
    })
  })

  it('folds the edges into links from a project to what it reaches, each file once, dropping edges inside a project and from no project', () => {
    expect(document.links).toEqual([
      {
        source: 'lib-a',
        target: 'config:tsconfig.base.json',
        kind: 'config',
        role: 'build-config',
        files: [
          { file: 'libs/a/project.json', line: null, specifier: null },
          { file: 'nx.json', line: null, specifier: null },
        ],
      },
      {
        source: 'lib-a',
        target: 'entry:@scope/b',
        kind: 'type',
        role: 'spec',
        files: [{ file: 'libs/a/src/a.spec.ts', line: 1, specifier: 'entry:@scope/b' }],
      },
      {
        source: 'lib-a',
        target: 'entry:@scope/b',
        kind: 'value',
        role: 'production',
        files: [
          { file: 'libs/a/src/index.ts', line: 3, specifier: 'entry:@scope/b' },
          { file: 'libs/a/src/index.ts', line: 7, specifier: 'entry:@scope/b' },
          { file: 'libs/a/src/other.ts', line: 1, specifier: 'entry:@scope/b' },
        ],
      },
      {
        source: 'lib-a',
        target: 'entry:@scope/b',
        kind: 'value',
        role: 'spec',
        files: [{ file: 'libs/a/src/a.spec.ts', line: 2, specifier: 'entry:@scope/b' }],
      },
      {
        source: 'lib-a',
        target: 'external:left-pad@1.0.0',
        kind: 'value',
        role: 'production',
        files: [{ file: 'libs/a/src/index.ts', line: 2, specifier: 'external:left-pad@1.0.0' }],
      },
      {
        source: 'lib-a',
        target: 'external:right-pad@*',
        kind: 'value',
        role: 'production',
        files: [{ file: 'libs/a/src/index.ts', line: 8, specifier: 'external:right-pad@*' }],
      },
      {
        source: 'lib-a',
        target: 'project:lib-b',
        kind: 'dynamic',
        role: 'production',
        files: [{ file: 'libs/a/src/index.ts', line: 5, specifier: 'file:libs/b/src/index.ts' }],
      },
      {
        source: 'lib-a',
        target: 'tool:@hyperfrontend/package:build',
        kind: 'tool',
        role: 'build-config',
        files: [{ file: 'libs/a/project.json', line: null, specifier: null }],
      },
      {
        source: 'lib-a',
        target: 'tool:@hyperfrontend/package:test',
        kind: 'tool',
        role: 'test-config',
        files: [{ file: 'nx.json', line: null, specifier: null }],
      },
      {
        source: 'lib-b',
        target: 'project:lib-a',
        kind: 'declared',
        role: 'build-config',
        files: [{ file: 'libs/b/project.json', line: null, specifier: null }],
      },
    ])
  })

  it('stamps the schema, the commit and the time', () => {
    expect({ schema: document.schema, sha: document.sha, generatedAt: document.generatedAt }).toEqual({
      schema: 1,
      sha: 'abc',
      generatedAt: 42,
    })
  })
})
