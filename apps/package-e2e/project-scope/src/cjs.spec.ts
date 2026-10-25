/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/project-scope`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `require` sees them.
 */

'use strict'

const { describe, it, expect } = require('@hyperfrontend/testing')
const { usePackedConsumer } = require('@hyperfrontend/testing/consumer')

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/project-scope CJS', () => {
  it('requires every export entry', () => {
    expect(consumer.entries('require').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the main entry', () => {
    const surface = consumer.run(
      async () => {
        const entry = require('@hyperfrontend/project-scope')
        return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof entry[name]]))
      },
      { kind: 'require' }
    )
    expect(surface).toEqual(
      expect.objectContaining({
        createTree: 'function',
        createTreeFromDisk: 'function',
        createMemoryTree: 'function',
        analyzeProject: 'function',
        isNxWorkspace: 'function',
        findNxWorkspaceRoot: 'function',
        isNxProject: 'function',
        getNxWorkspaceInfo: 'function',
        discoverNxProjects: 'function',
        buildSimpleProjectGraph: 'function',
        nxDetector: 'function',
      })
    )
  })

  it('reads a file held in a memory tree', () => {
    const text = consumer.run(
      async () => {
        const { createMemoryTree } = require('@hyperfrontend/project-scope')
        return createMemoryTree({ 'a.txt': 'a' }).read('a.txt', 'utf-8')
      },
      { kind: 'require' }
    )
    expect(text).toBe('a')
  })

  it('buffers a write over a file held in a memory tree as an update', () => {
    const changes = consumer.run(
      async () => {
        const { createMemoryTree } = require('@hyperfrontend/project-scope')
        const tree = createMemoryTree({ 'package.json': '{}' })
        tree.write('package.json', '{"name":"app"}')
        return tree.listChanges().map(({ path, type }) => ({ path, type }))
      },
      { kind: 'require' }
    )
    expect(changes).toEqual([
      {
        path: 'package.json',
        type: 'UPDATE',
      },
    ])
  })

  it('records a file written to a new path as a create', () => {
    const changes = consumer.run(
      async () => {
        const { createMemoryTree } = require('@hyperfrontend/project-scope')
        const tree = createMemoryTree()
        tree.write('src/index.ts', 'export const x = 1\n')
        return [tree.exists('src/index.ts'), tree.listChanges().map(({ type }) => type)]
      },
      { kind: 'require' }
    )
    expect(changes).toEqual([true, ['CREATE']])
  })

  it('analyses the consumer directory under its manifest name', () => {
    const analysedName = consumer.run(
      async () => {
        const { analyzeProject } = require('@hyperfrontend/project-scope')
        return analyzeProject(process.cwd()).name
      },
      { kind: 'require' }
    )
    expect(analysedName).toBe('consumer')
  })

  it('reports that the consumer directory is not an Nx workspace', () => {
    const nx = consumer.run(
      async () => {
        const { isNxWorkspace } = require('@hyperfrontend/project-scope')
        return isNxWorkspace(process.cwd())
      },
      { kind: 'require' }
    )
    expect(nx).toBe(false)
  })
})
