import { existsSync, readdirSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { readNxGraph } from './read-graph'

const tempRoot = useTempDir({ prefix: 'read-graph-' })

/**
 * A runner standing in for `nx graph --file`, writing the given document at the path asked for.
 *
 * @param document - What the fake Nx writes
 * @returns The runner
 */
function fakeNx(document: object): (args: readonly string[]) => string {
  return (args) => {
    const file = (args.find((argument) => argument.startsWith('--file=')) as string).slice('--file='.length)
    writeFileSync(file, JSON.stringify(document))
    return ''
  }
}

describe('readNxGraph', () => {
  it('returns the graph Nx wrote', () => {
    const graph = { nodes: { 'lib-a': { type: 'lib', name: 'lib-a', data: { root: 'libs/a' } } }, dependencies: { 'lib-a': [] } }
    expect(readNxGraph(fakeNx({ graph, affectedProjects: [] }), { tempRoot: tempRoot.path })).toEqual(graph)
  })

  it('removes the temporary file afterwards', () => {
    readNxGraph(fakeNx({ graph: { nodes: {}, dependencies: {} } }), { tempRoot: tempRoot.path })
    expect(readdirSync(tempRoot.path)).toEqual([])
  })

  it('writes the temporary file under the system temporary directory by default', () => {
    const graph = { nodes: {}, dependencies: {} }
    expect(readNxGraph(fakeNx({ graph }))).toEqual(graph)
  })

  it('throws when the file carries no graph', () => {
    expect(() => readNxGraph(fakeNx({}), { tempRoot: tempRoot.path })).toThrow('nx graph --file wrote a file without a graph')
  })

  it('removes the temporary file when the graph is missing', () => {
    try {
      readNxGraph(fakeNx({}), { tempRoot: tempRoot.path })
    } catch {
      // note: the throw is the subject of the previous test; here only the cleanup matters.
    }
    expect(existsSync(tempRoot.path) && readdirSync(tempRoot.path).length === 0).toBe(true)
  })
})
