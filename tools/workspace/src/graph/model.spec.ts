import type { GraphNode } from './model'
import { describe, expect, it } from '@hyperfrontend/testing'
import { nodeId, taskId } from './model'
import { Role } from './roles'

/** Every node kind beside the id it is given. */
const NODE_IDS: ReadonlyArray<readonly [GraphNode, string]> = [
  [{ kind: 'project', name: 'lib-a', root: 'libs/a' }, 'project:lib-a'],
  [{ kind: 'file', path: 'libs/a/src/index.ts', project: 'lib-a', role: Role.Production }, 'file:libs/a/src/index.ts'],
  [{ kind: 'entry', id: '@fixture/a/extra', project: 'lib-a', file: 'libs/a/src/extra/index.ts' }, 'entry:@fixture/a/extra'],
  [{ kind: 'external', name: 'left-pad', version: '1.3.0' }, 'external:left-pad@1.3.0'],
  [{ kind: 'external', name: 'unversioned', version: null }, 'external:unversioned@*'],
  [{ kind: 'tool', id: '@hyperfrontend/package:build', project: 'tool-package', entry: null }, 'tool:@hyperfrontend/package:build'],
  [{ kind: 'config', path: 'nx.json' }, 'config:nx.json'],
  [{ kind: 'task', project: 'lib-a', target: 'build' }, 'task:lib-a:build'],
]

describe('nodeId', () => {
  it.each(NODE_IDS)('identifies %p as %s', (node: GraphNode, id: string) => {
    expect(nodeId(node)).toBe(id)
  })
})

describe('taskId', () => {
  it('writes a task as Nx does', () => {
    expect(taskId({ kind: 'task', project: 'lib-a', target: 'version:all' })).toBe('lib-a:version:all')
  })
})
