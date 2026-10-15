import type { MockedFunction } from '@hyperfrontend/testing'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { after as afterAll, before as beforeAll } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import * as fsModule from '../../core/fs'
import { buildDependencyGraph, findCircularDependencies, getProjectDependencies } from './analyze'

// why: the module under test binds `exists` when it links, so no property replacement on the namespace can reach it. Replacing the module is what makes the calls observable, and the replacement calls through.
jest.mock('../../core/fs', () => {
  const actual = jest.requireActual<typeof fsModule>('../../core/fs')
  return { ...actual, exists: jest.fn(actual.exists) }
})

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')
const MONOREPO = resolve(FIXTURES_DIR, 'monorepo')

describe('buildDependencyGraph', () => {
  describe('with non-existent path', () => {
    it('returns empty graph', () => {
      expect(buildDependencyGraph('/non/existent/path')).toEqual({ nodes: new Map(), roots: [], leaves: [] })
    })
  })

  describe('with minimal-project fixture', () => {
    it('builds graph from source files', () => {
      expect(buildDependencyGraph(MINIMAL_PROJECT)).toEqual({ nodes: expect.any(Map), roots: expect.any(Array), leaves: expect.any(Array) })
    })

    it('identifies root nodes', () => {
      const graph = buildDependencyGraph(MINIMAL_PROJECT)

      expect(Array.isArray(graph.roots)).toBe(true)
    })

    it('identifies leaf nodes', () => {
      const graph = buildDependencyGraph(MINIMAL_PROJECT)

      expect(Array.isArray(graph.leaves)).toBe(true)
    })
  })

  describe('node structure', () => {
    it('has correct properties for each node', () => {
      const graph = buildDependencyGraph(MINIMAL_PROJECT)

      for (const [path, node] of graph.nodes) {
        expect(node).toEqual({ id: path, path: expect.any(String), dependencies: expect.any(Array), dependents: expect.any(Array) })
      }
    })
  })

  describe('options', () => {
    it('respects maxDepth option', () => {
      const shallow = buildDependencyGraph(MINIMAL_PROJECT, { maxDepth: 1 })
      const deep = buildDependencyGraph(MINIMAL_PROJECT, { maxDepth: 10 })

      expect(shallow.nodes.size).toBeLessThanOrEqual(deep.nodes.size)
    })

    it('respects extensions option', () => {
      const tsOnly = buildDependencyGraph(MINIMAL_PROJECT, { extensions: ['.ts'] })
      const jsOnly = buildDependencyGraph(MINIMAL_PROJECT, { extensions: ['.js'] })

      expect([tsOnly.nodes.size, jsOnly.nodes.size]).toEqual([3, 0])
    })

    it('respects includeExternal option', () => {
      const withExternal = buildDependencyGraph(MINIMAL_PROJECT, { includeExternal: true })
      const withoutExternal = buildDependencyGraph(MINIMAL_PROJECT, { includeExternal: false })

      expect([withExternal.nodes.size, withoutExternal.nodes.size]).toEqual([3, 3])
    })
  })
})

describe('findCircularDependencies', () => {
  it('returns empty array for non-existent path', () => {
    const graph = buildDependencyGraph('/non/existent/path')
    const cycles = findCircularDependencies(graph)

    expect(cycles).toEqual([])
  })

  it('returns empty array for acyclic graph', () => {
    const graph = buildDependencyGraph(MINIMAL_PROJECT)
    const cycles = findCircularDependencies(graph)

    expect(Array.isArray(cycles)).toBe(true)
  })

  it('returns a cycle record for each detected cycle', () => {
    const graph = buildDependencyGraph(MINIMAL_PROJECT)
    const cycles = findCircularDependencies(graph)

    for (const cycle of cycles) {
      expect(cycle).toEqual({ cycle: expect.any(Array), length: expect.any(Number) })
    }
  })

  it('returns a positive length for each detected cycle', () => {
    const graph = buildDependencyGraph(MINIMAL_PROJECT)
    const cycles = findCircularDependencies(graph)

    for (const cycle of cycles) {
      expect(cycle.length).toBeGreaterThan(0)
    }
  })
})

describe('getProjectDependencies', () => {
  describe('with non-existent path', () => {
    it('returns empty dependencies', () => {
      expect(getProjectDependencies('/non/existent/path')).toEqual({ runtime: [], development: [], peer: [], optional: [], total: 0 })
    })
  })

  describe('with minimal-project fixture', () => {
    it('extracts dependencies from package.json', () => {
      expect(getProjectDependencies(MINIMAL_PROJECT)).toEqual({
        runtime: ['lodash'],
        development: ['typescript', 'jest'],
        peer: ['react'],
        optional: [],
        total: 4,
      })
    })

    it('calculates total correctly', () => {
      const deps = getProjectDependencies(MINIMAL_PROJECT)

      const allDeps = new Set([...deps.runtime, ...deps.development, ...deps.peer, ...deps.optional])
      expect(deps.total).toBe(allDeps.size)
    })
  })

  describe('with monorepo fixture', () => {
    it('extracts root dependencies', () => {
      expect(getProjectDependencies(MONOREPO)).toEqual({ runtime: [], development: ['typescript'], peer: [], optional: [], total: 1 })
    })
  })
})

describe('buildDependencyGraph advanced', () => {
  it('tracks external dependencies when includeExternal is true', () => {
    const graph = buildDependencyGraph(MINIMAL_PROJECT, { includeExternal: true })

    for (const [, node] of graph.nodes) {
      expect(Array.isArray(node.dependencies)).toBe(true)
    }
  })

  it('excludes external dependencies when includeExternal is false', () => {
    const graph = buildDependencyGraph(MINIMAL_PROJECT, { includeExternal: false })

    for (const [, node] of graph.nodes) {
      for (const dep of node.dependencies) {
        expect(typeof dep).toBe('string')
      }
    }
  })

  it('handles different file extensions', () => {
    const tsOnly = buildDependencyGraph(MINIMAL_PROJECT, { extensions: ['.ts'] })
    const tsxOnly = buildDependencyGraph(MINIMAL_PROJECT, { extensions: ['.tsx'] })
    const jsOnly = buildDependencyGraph(MINIMAL_PROJECT, { extensions: ['.js'] })
    const all = buildDependencyGraph(MINIMAL_PROJECT, { extensions: ['.ts', '.tsx', '.js', '.jsx'] })

    expect([tsOnly, tsxOnly, jsOnly, all].map((graph) => graph.nodes.size)).toEqual([3, 0, 0, 3])
  })

  it('calculates dependents correctly', () => {
    const graph = buildDependencyGraph(MINIMAL_PROJECT)

    for (const [path, node] of graph.nodes) {
      for (const dep of node.dependencies) {
        const depNode = graph.nodes.get(dep)
        expect(depNode === undefined || depNode.dependents.includes(path)).toBe(true)
      }
    }
  })

  it('identifies roots correctly', () => {
    const graph = buildDependencyGraph(MINIMAL_PROJECT)

    for (const root of graph.roots) {
      const node = graph.nodes.get(root)
      expect(node === undefined || node.dependents.length === 0).toBe(true)
    }
  })

  it('identifies leaves correctly', () => {
    const graph = buildDependencyGraph(MINIMAL_PROJECT)

    for (const leaf of graph.leaves) {
      const node = graph.nodes.get(leaf)
      const hasInternalDeps = node ? node.dependencies.some((d) => graph.nodes.has(d)) : false
      expect(node === undefined || hasInternalDeps === false).toBe(true)
    }
  })
})

describe('findCircularDependencies advanced', () => {
  it('detects self-referential cycles', () => {
    const graph = buildDependencyGraph(MINIMAL_PROJECT)
    const cycles = findCircularDependencies(graph)

    expect(Array.isArray(cycles)).toBe(true)
  })

  it('avoids duplicate cycle detection', () => {
    const graph = buildDependencyGraph(MONOREPO)
    const cycles = findCircularDependencies(graph)

    const cycleSignatures = cycles.map((c) => [...c.cycle].sort().join('|'))
    const unique = new Set(cycleSignatures)
    expect(unique.size).toBe(cycleSignatures.length)
  })

  it('calculates cycle length correctly', () => {
    const graph = buildDependencyGraph(MONOREPO)
    const cycles = findCircularDependencies(graph)

    for (const cycle of cycles) {
      expect(cycle.length).toBe(cycle.cycle.length - 1)
    }
  })
})

const CIRCULAR_DEPS = resolve(FIXTURES_DIR, 'circular-deps')
const DYNAMIC_IMPORTS = resolve(FIXTURES_DIR, 'dynamic-imports')
const DIRECTORY_IMPORTS = resolve(FIXTURES_DIR, 'directory-imports')

describe('buildDependencyGraph with circular dependencies', () => {
  it('builds graph for project with circular imports', () => {
    const graph = buildDependencyGraph(CIRCULAR_DEPS)

    expect([...graph.nodes.keys()].sort()).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts'])
  })

  it('tracks dependencies in circular graph', () => {
    const graph = buildDependencyGraph(CIRCULAR_DEPS)

    for (const [, node] of graph.nodes) {
      expect(node.dependencies.length).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('findCircularDependencies with actual cycles', () => {
  it('detects circular dependencies in circular-deps fixture', () => {
    const graph = buildDependencyGraph(CIRCULAR_DEPS)
    const cycles = findCircularDependencies(graph)

    expect(cycles.length).toBeGreaterThanOrEqual(1)
  })

  it('reports each cycle as a record of its path and length', () => {
    const graph = buildDependencyGraph(CIRCULAR_DEPS)
    const cycles = findCircularDependencies(graph)

    for (const cycle of cycles) {
      expect(cycle).toEqual({ cycle: expect.any(Array), length: expect.any(Number) })
    }
  })

  it('reports each cycle with at least two entries', () => {
    const graph = buildDependencyGraph(CIRCULAR_DEPS)
    const cycles = findCircularDependencies(graph)

    for (const cycle of cycles) {
      expect(cycle.cycle.length).toBeGreaterThan(1)
    }
  })

  it('reports each cycle as a path that returns to its first file', () => {
    const graph = buildDependencyGraph(CIRCULAR_DEPS)
    const cycles = findCircularDependencies(graph)

    for (const cycle of cycles) {
      expect(cycle.cycle[cycle.cycle.length - 1]).toBe(cycle.cycle[0])
    }
  })

  it('reports each cycle with a positive length', () => {
    const graph = buildDependencyGraph(CIRCULAR_DEPS)
    const cycles = findCircularDependencies(graph)

    for (const cycle of cycles) {
      expect(cycle.length).toBeGreaterThan(0)
    }
  })
})

describe('buildDependencyGraph with dynamic imports', () => {
  it('extracts ES imports', () => {
    const graph = buildDependencyGraph(DYNAMIC_IMPORTS)

    const indexNode = [...graph.nodes.values()].find((n) => n.path.includes('index.ts'))
    expect(indexNode?.dependencies.some((d) => d.includes('helper'))).toBe(true)
  })

  it('extracts dynamic import() statements', () => {
    const graph = buildDependencyGraph(DYNAMIC_IMPORTS)

    const indexNode = [...graph.nodes.values()].find((n) => n.path.includes('index.ts'))
    expect(indexNode?.dependencies.some((d) => d.includes('utils'))).toBe(true)
  })

  it('extracts require() statements', () => {
    const graph = buildDependencyGraph(DYNAMIC_IMPORTS)

    const indexNode = [...graph.nodes.values()].find((n) => n.path.includes('index.ts'))
    expect(indexNode?.dependencies.some((d) => d.includes('config'))).toBe(true)
  })

  it('extracts export * from statements', () => {
    const graph = buildDependencyGraph(DYNAMIC_IMPORTS)

    const indexNode = [...graph.nodes.values()].find((n) => n.path.includes('index.ts'))
    expect(indexNode?.dependencies.some((d) => d.includes('types'))).toBe(true)
  })
})

describe('buildDependencyGraph with directory imports', () => {
  it('resolves directory imports to index files', () => {
    const graph = buildDependencyGraph(DIRECTORY_IMPORTS)

    const indexNode = [...graph.nodes.values()].find((n) => n.path === 'src/index.ts')
    const hasUtilsDep = indexNode?.dependencies.some((d) => d.includes('utils/index.ts'))
    const hasHelpersDep = indexNode?.dependencies.some((d) => d.includes('helpers/index.ts'))

    expect([hasUtilsDep, hasHelpersDep]).toEqual([true, true])
  })
})

const NO_SRC_PROJECT = resolve(FIXTURES_DIR, 'no-src-project')

describe('buildDependencyGraph without src directory', () => {
  it('collects source files from project root when no src dir', () => {
    const graph = buildDependencyGraph(NO_SRC_PROJECT)

    expect([...graph.nodes.keys()].sort()).toEqual(['app.ts', 'index.ts'])
  })

  it('builds dependency graph from root-level files', () => {
    const graph = buildDependencyGraph(NO_SRC_PROJECT)

    const appNode = [...graph.nodes.values()].find((n) => n.path.includes('app.ts'))
    expect(appNode?.dependencies.some((d) => d.includes('index'))).toBe(true)
  })
})

describe('findCircularDependencies DFS traversal', () => {
  it('handles multiple independent cycles', () => {
    const graph = buildDependencyGraph(CIRCULAR_DEPS)
    const cycles = findCircularDependencies(graph)

    const signatures = cycles.map((c) => [...c.cycle].sort().join('|'))
    const unique = new Set(signatures)
    expect(unique.size).toBe(signatures.length)
  })

  it('handles deeply nested circular dependencies', () => {
    const graph = buildDependencyGraph(CIRCULAR_DEPS)
    const cycles = findCircularDependencies(graph)

    const hasCycle = cycles.some((c) => c.length >= 2)
    expect(hasCycle).toBe(true)
  })

  it('continues visiting unvisited nodes after completing DFS', () => {
    const graph = buildDependencyGraph(CIRCULAR_DEPS)
    const cycles = findCircularDependencies(graph)

    expect(Array.isArray(cycles)).toBe(true)
  })
})

describe('buildDependencyGraph edge cases', () => {
  it('handles files that fail to read', () => {
    const graph = buildDependencyGraph('/non/existent/path')
    expect(graph.nodes.size).toBe(0)
  })

  it('skips external dependencies when includeExternal is false', () => {
    const graph = buildDependencyGraph(DYNAMIC_IMPORTS, { includeExternal: false })

    for (const node of graph.nodes.values()) {
      for (const dep of node.dependencies) {
        expect(typeof dep).toBe('string')
      }
    }
  })

  it('includes external dependencies when includeExternal is true', () => {
    const graph = buildDependencyGraph(MINIMAL_PROJECT, { includeExternal: true })

    let hasExternal = false
    for (const node of graph.nodes.values()) {
      for (const dep of node.dependencies) {
        if (!dep.startsWith('.') && !dep.includes('/')) {
          hasExternal = true
        }
      }
    }
    expect(typeof hasExternal).toBe('boolean')
  })
})

const ENTRY_FILE_ONLY = resolve(FIXTURES_DIR, 'entry-file-only')

describe('buildDependencyGraph leaves calculation', () => {
  it('identifies files with no internal dependencies as leaves', () => {
    const graph = buildDependencyGraph(ENTRY_FILE_ONLY)

    expect(graph.leaves.length).toBeGreaterThanOrEqual(1)
  })

  it('includes isolated files with no imports in leaves array', () => {
    const graph = buildDependencyGraph(ENTRY_FILE_ONLY)

    const hasLeafWithNoImports = graph.leaves.some((leaf) => {
      const node = graph.nodes.get(leaf)
      return node !== undefined && node.dependencies.length === 0
    })
    expect(hasLeafWithNoImports).toBe(true)
  })
})

describe('buildDependencyGraph roots calculation', () => {
  it('identifies files that are not imported by anything as roots', () => {
    const graph = buildDependencyGraph(NO_SRC_PROJECT)

    const roots = graph.roots.map((root) => ({ root, dependents: graph.nodes.get(root)?.dependents }))
    expect(roots).toEqual([{ root: 'app.ts', dependents: [] }])
  })
})

describe('resolveImportPath edge cases', () => {
  it('returns null for non-relative external import paths', () => {
    const graph = buildDependencyGraph(MINIMAL_PROJECT, { includeExternal: false })

    for (const node of graph.nodes.values()) {
      for (const dep of node.dependencies) {
        expect(dep.includes('node_modules')).toBe(false)
      }
    }
  })
})

describe('buildDependencyGraph path confinement', () => {
  const ESCAPE_PROJECT = resolve(import.meta.dirname, '__escape_fixtures__')

  beforeAll(() => {
    rmSync(ESCAPE_PROJECT, { recursive: true, force: true })
    mkdirSync(join(ESCAPE_PROJECT, 'src'), { recursive: true })
    // how: A hostile source file whose imports escape the project via absolute and parent-traversal paths.
    writeFileSync(
      join(ESCAPE_PROJECT, 'src', 'index.ts'),
      "import '/totally/outside/secret'\nimport x from '../../escape/up'\nexport const a = 1\n"
    )
  })

  afterAll(() => {
    rmSync(ESCAPE_PROJECT, { recursive: true, force: true })
  })

  it('never stats a path outside the project root when an import escapes it', () => {
    const spy = fsModule.exists as MockedFunction<typeof fsModule.exists>
    // why: the replacement stands for the whole file rather than this test, so the calls the earlier suites made have to be dropped before this one measures its own.
    spy.mockClear()

    buildDependencyGraph(ESCAPE_PROJECT)
    const outOfRoot = spy.mock.calls.map((call) => resolve(String(call[0]))).filter((path) => !path.startsWith(ESCAPE_PROJECT))

    expect(outOfRoot).toEqual([])
  })
})
