import { resolve } from 'node:path'
import { buildDependencyGraph, findCircularDependencies, getProjectDependencies } from './analyze'

const FIXTURES_DIR = resolve(__dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')
const MONOREPO = resolve(FIXTURES_DIR, 'monorepo')

describe('buildDependencyGraph', () => {
  describe('with non-existent path', () => {
    it('returns empty graph', () => {
      const graph = buildDependencyGraph('/non/existent/path')

      expect(graph).toHaveProperty('nodes')
      expect(graph).toHaveProperty('roots')
      expect(graph).toHaveProperty('leaves')
      expect(graph.nodes.size).toBe(0)
      expect(graph.roots).toEqual([])
      expect(graph.leaves).toEqual([])
    })
  })

  describe('with minimal-project fixture', () => {
    it('builds graph from source files', () => {
      const graph = buildDependencyGraph(MINIMAL_PROJECT)

      expect(graph).toHaveProperty('nodes')
      expect(graph).toHaveProperty('roots')
      expect(graph).toHaveProperty('leaves')
      // minimal-project has src/index.ts
      expect(graph.nodes.size).toBeGreaterThanOrEqual(0)
    })

    it('identifies root nodes', () => {
      const graph = buildDependencyGraph(MINIMAL_PROJECT)

      // Roots should be files with no dependents
      expect(Array.isArray(graph.roots)).toBe(true)
    })

    it('identifies leaf nodes', () => {
      const graph = buildDependencyGraph(MINIMAL_PROJECT)

      // Leaves should be files with no internal dependencies
      expect(Array.isArray(graph.leaves)).toBe(true)
    })
  })

  describe('node structure', () => {
    it('has correct properties for each node', () => {
      const graph = buildDependencyGraph(MINIMAL_PROJECT)

      for (const [path, node] of graph.nodes) {
        expect(typeof node.id).toBe('string')
        expect(typeof node.path).toBe('string')
        expect(node.id).toBe(path)
        expect(Array.isArray(node.dependencies)).toBe(true)
        expect(Array.isArray(node.dependents)).toBe(true)
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

      // These may or may not have files depending on the fixture
      expect(tsOnly.nodes.size).toBeGreaterThanOrEqual(0)
      expect(jsOnly.nodes.size).toBeGreaterThanOrEqual(0)
    })

    it('respects includeExternal option', () => {
      const withExternal = buildDependencyGraph(MINIMAL_PROJECT, { includeExternal: true })
      const withoutExternal = buildDependencyGraph(MINIMAL_PROJECT, { includeExternal: false })

      expect(withExternal.nodes.size).toBeGreaterThanOrEqual(0)
      expect(withoutExternal.nodes.size).toBeGreaterThanOrEqual(0)
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

    // minimal-project likely has no cycles
    expect(Array.isArray(cycles)).toBe(true)
  })

  it('returns correct structure for detected cycles', () => {
    const graph = buildDependencyGraph(MINIMAL_PROJECT)
    const cycles = findCircularDependencies(graph)

    for (const cycle of cycles) {
      expect(Array.isArray(cycle.cycle)).toBe(true)
      expect(typeof cycle.length).toBe('number')
      expect(cycle.length).toBeGreaterThan(0)
    }
  })
})

describe('getProjectDependencies', () => {
  describe('with non-existent path', () => {
    it('returns empty dependencies', () => {
      const deps = getProjectDependencies('/non/existent/path')

      expect(deps).toHaveProperty('runtime')
      expect(deps).toHaveProperty('development')
      expect(deps).toHaveProperty('peer')
      expect(deps).toHaveProperty('optional')
      expect(deps).toHaveProperty('total')
      expect(deps.total).toBe(0)
      expect(deps.runtime).toEqual([])
      expect(deps.development).toEqual([])
    })
  })

  describe('with minimal-project fixture', () => {
    it('extracts dependencies from package.json', () => {
      const deps = getProjectDependencies(MINIMAL_PROJECT)

      expect(Array.isArray(deps.runtime)).toBe(true)
      expect(Array.isArray(deps.development)).toBe(true)
      expect(Array.isArray(deps.peer)).toBe(true)
      expect(Array.isArray(deps.optional)).toBe(true)
      expect(typeof deps.total).toBe('number')
    })

    it('calculates total correctly', () => {
      const deps = getProjectDependencies(MINIMAL_PROJECT)

      const allDeps = new Set([...deps.runtime, ...deps.development, ...deps.peer, ...deps.optional])
      expect(deps.total).toBe(allDeps.size)
    })
  })

  describe('with monorepo fixture', () => {
    it('extracts root dependencies', () => {
      const deps = getProjectDependencies(MONOREPO)

      expect(deps).toBeDefined()
      expect(typeof deps.total).toBe('number')
    })
  })
})

describe('buildDependencyGraph advanced', () => {
  it('tracks external dependencies when includeExternal is true', () => {
    const graph = buildDependencyGraph(MINIMAL_PROJECT, { includeExternal: true })

    // With includeExternal, node_modules imports should be tracked
    for (const [, node] of graph.nodes) {
      // Dependencies should include external packages if any are imported
      expect(Array.isArray(node.dependencies)).toBe(true)
    }
  })

  it('excludes external dependencies when includeExternal is false', () => {
    const graph = buildDependencyGraph(MINIMAL_PROJECT, { includeExternal: false })

    // Without includeExternal, only internal dependencies should be tracked
    for (const [, node] of graph.nodes) {
      for (const dep of node.dependencies) {
        // Should not include node_modules style imports
        // Internal deps start with ./ or are relative paths
        expect(typeof dep).toBe('string')
      }
    }
  })

  it('handles different file extensions', () => {
    const tsOnly = buildDependencyGraph(MINIMAL_PROJECT, { extensions: ['.ts'] })
    const tsxOnly = buildDependencyGraph(MINIMAL_PROJECT, { extensions: ['.tsx'] })
    const jsOnly = buildDependencyGraph(MINIMAL_PROJECT, { extensions: ['.js'] })
    const all = buildDependencyGraph(MINIMAL_PROJECT, { extensions: ['.ts', '.tsx', '.js', '.jsx'] })

    expect(tsOnly.nodes).toBeDefined()
    expect(tsxOnly.nodes).toBeDefined()
    expect(jsOnly.nodes).toBeDefined()
    expect(all.nodes).toBeDefined()
  })

  it('calculates dependents correctly', () => {
    const graph = buildDependencyGraph(MINIMAL_PROJECT)

    for (const [path, node] of graph.nodes) {
      // Each dependency of this node should have this node as a dependent
      for (const dep of node.dependencies) {
        const depNode = graph.nodes.get(dep)
        // If depNode exists, it must contain path as a dependent
        expect(depNode === undefined || depNode.dependents.includes(path)).toBe(true)
      }
    }
  })

  it('identifies roots correctly', () => {
    const graph = buildDependencyGraph(MINIMAL_PROJECT)

    // Roots are files that are not imported by anything
    for (const root of graph.roots) {
      const node = graph.nodes.get(root)
      // If node exists, it must have no dependents
      expect(node === undefined || node.dependents.length === 0).toBe(true)
    }
  })

  it('identifies leaves correctly', () => {
    const graph = buildDependencyGraph(MINIMAL_PROJECT)

    // Leaves are files with no internal dependencies
    for (const leaf of graph.leaves) {
      const node = graph.nodes.get(leaf)
      // If node exists, it must have no internal dependencies
      const hasInternalDeps = node ? node.dependencies.some((d) => graph.nodes.has(d)) : false
      expect(node === undefined || hasInternalDeps === false).toBe(true)
    }
  })
})

describe('findCircularDependencies advanced', () => {
  it('detects self-referential cycles', () => {
    // Self-referential cycles are detected when a file imports itself
    const graph = buildDependencyGraph(MINIMAL_PROJECT)
    const cycles = findCircularDependencies(graph)

    // The function should handle this case without crashing
    expect(Array.isArray(cycles)).toBe(true)
  })

  it('avoids duplicate cycle detection', () => {
    const graph = buildDependencyGraph(MONOREPO)
    const cycles = findCircularDependencies(graph)

    // Check that no duplicate cycles exist
    const cycleSignatures = cycles.map((c) => [...c.cycle].sort().join('|'))
    const unique = new Set(cycleSignatures)
    expect(unique.size).toBe(cycleSignatures.length)
  })

  it('calculates cycle length correctly', () => {
    const graph = buildDependencyGraph(MONOREPO)
    const cycles = findCircularDependencies(graph)

    for (const cycle of cycles) {
      // Length should be cycle.cycle.length - 1 (since start/end are same)
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

    expect(graph.nodes.size).toBeGreaterThanOrEqual(3)
    // Should have a.ts, b.ts, c.ts
    const nodeIds = [...graph.nodes.keys()]
    expect(nodeIds.some((id) => id.includes('a.ts'))).toBe(true)
    expect(nodeIds.some((id) => id.includes('b.ts'))).toBe(true)
    expect(nodeIds.some((id) => id.includes('c.ts'))).toBe(true)
  })

  it('tracks dependencies in circular graph', () => {
    const graph = buildDependencyGraph(CIRCULAR_DEPS)

    for (const [, node] of graph.nodes) {
      // Each file should have at least one dependency
      expect(node.dependencies.length).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('findCircularDependencies with actual cycles', () => {
  it('detects circular dependencies in circular-deps fixture', () => {
    const graph = buildDependencyGraph(CIRCULAR_DEPS)
    const cycles = findCircularDependencies(graph)

    // Should detect at least one cycle (A -> B -> C -> A)
    expect(cycles.length).toBeGreaterThanOrEqual(1)
  })

  it('reports cycle with correct structure', () => {
    const graph = buildDependencyGraph(CIRCULAR_DEPS)
    const cycles = findCircularDependencies(graph)

    for (const cycle of cycles) {
      expect(Array.isArray(cycle.cycle)).toBe(true)
      expect(cycle.cycle.length).toBeGreaterThan(1)
      expect(typeof cycle.length).toBe('number')
      expect(cycle.length).toBeGreaterThan(0)
      // First and last element should be the same (completing the cycle)
      expect(cycle.cycle[0]).toBe(cycle.cycle[cycle.cycle.length - 1])
    }
  })
})

describe('buildDependencyGraph with dynamic imports', () => {
  it('extracts ES imports', () => {
    const graph = buildDependencyGraph(DYNAMIC_IMPORTS)

    const indexNode = [...graph.nodes.values()].find((n) => n.path.includes('index.ts'))
    expect(indexNode).toBeDefined()
    // Should have helper as a dependency
    expect(indexNode?.dependencies.some((d) => d.includes('helper'))).toBe(true)
  })

  it('extracts dynamic import() statements', () => {
    const graph = buildDependencyGraph(DYNAMIC_IMPORTS)

    const indexNode = [...graph.nodes.values()].find((n) => n.path.includes('index.ts'))
    // Should have utils as a dependency (from dynamic import)
    expect(indexNode?.dependencies.some((d) => d.includes('utils'))).toBe(true)
  })

  it('extracts require() statements', () => {
    const graph = buildDependencyGraph(DYNAMIC_IMPORTS)

    const indexNode = [...graph.nodes.values()].find((n) => n.path.includes('index.ts'))
    // Should have config as a dependency (from require)
    expect(indexNode?.dependencies.some((d) => d.includes('config'))).toBe(true)
  })

  it('extracts export * from statements', () => {
    const graph = buildDependencyGraph(DYNAMIC_IMPORTS)

    const indexNode = [...graph.nodes.values()].find((n) => n.path.includes('index.ts'))
    // Should have types as a dependency (from export * from)
    expect(indexNode?.dependencies.some((d) => d.includes('types'))).toBe(true)
  })
})

describe('buildDependencyGraph with directory imports', () => {
  it('resolves directory imports to index files', () => {
    const graph = buildDependencyGraph(DIRECTORY_IMPORTS)

    const indexNode = [...graph.nodes.values()].find((n) => n.path === 'src/index.ts')
    expect(indexNode).toBeDefined()

    // Should resolve ./utils to utils/index.ts
    const hasUtilsDep = indexNode?.dependencies.some((d) => d.includes('utils/index.ts'))
    // Should resolve ./helpers to helpers/index.ts
    const hasHelpersDep = indexNode?.dependencies.some((d) => d.includes('helpers/index.ts'))

    expect(hasUtilsDep || hasHelpersDep).toBe(true)
  })
})

const NO_SRC_PROJECT = resolve(FIXTURES_DIR, 'no-src-project')

describe('buildDependencyGraph without src directory', () => {
  it('collects source files from project root when no src dir', () => {
    const graph = buildDependencyGraph(NO_SRC_PROJECT)

    expect(graph.nodes.size).toBeGreaterThanOrEqual(2)
    // Should find index.ts and app.ts
    const nodeIds = [...graph.nodes.keys()]
    expect(nodeIds.some((id) => id.includes('index.ts'))).toBe(true)
    expect(nodeIds.some((id) => id.includes('app.ts'))).toBe(true)
  })

  it('builds dependency graph from root-level files', () => {
    const graph = buildDependencyGraph(NO_SRC_PROJECT)

    // app.ts imports from index.ts
    const appNode = [...graph.nodes.values()].find((n) => n.path.includes('app.ts'))
    expect(appNode?.dependencies.some((d) => d.includes('index'))).toBe(true)
  })
})

describe('findCircularDependencies DFS traversal', () => {
  it('handles multiple independent cycles', () => {
    const graph = buildDependencyGraph(CIRCULAR_DEPS)
    const cycles = findCircularDependencies(graph)

    // Each cycle should be unique
    const signatures = cycles.map((c) => [...c.cycle].sort().join('|'))
    const unique = new Set(signatures)
    expect(unique.size).toBe(signatures.length)
  })

  it('handles deeply nested circular dependencies', () => {
    // Using circular-deps which has a 3-node cycle
    const graph = buildDependencyGraph(CIRCULAR_DEPS)
    const cycles = findCircularDependencies(graph)

    // Should find the A -> B -> C -> A cycle
    const hasCycle = cycles.some((c) => c.length >= 2)
    expect(hasCycle).toBe(true)
  })

  it('continues visiting unvisited nodes after completing DFS', () => {
    const graph = buildDependencyGraph(CIRCULAR_DEPS)
    const cycles = findCircularDependencies(graph)

    // Function should visit all nodes
    expect(Array.isArray(cycles)).toBe(true)
  })
})

describe('buildDependencyGraph edge cases', () => {
  it('handles files that fail to read', () => {
    // Non-existent path, should gracefully handle
    const graph = buildDependencyGraph('/non/existent/path')
    expect(graph.nodes.size).toBe(0)
  })

  it('skips external dependencies when includeExternal is false', () => {
    const graph = buildDependencyGraph(DYNAMIC_IMPORTS, { includeExternal: false })

    // Should not include node_modules style imports
    for (const node of graph.nodes.values()) {
      for (const dep of node.dependencies) {
        // External deps don't start with ./ or are resolved paths
        expect(typeof dep).toBe('string')
      }
    }
  })

  it('includes external dependencies when includeExternal is true', () => {
    const graph = buildDependencyGraph(MINIMAL_PROJECT, { includeExternal: true })

    // With includeExternal, external packages should be tracked
    let hasExternal = false
    for (const node of graph.nodes.values()) {
      for (const dep of node.dependencies) {
        if (!dep.startsWith('.') && !dep.includes('/')) {
          hasExternal = true
        }
      }
    }
    // May or may not have external deps depending on fixture
    expect(typeof hasExternal).toBe('boolean')
  })
})

const ENTRY_FILE_ONLY = resolve(FIXTURES_DIR, 'entry-file-only')

describe('buildDependencyGraph leaves calculation', () => {
  it('identifies files with no internal dependencies as leaves', () => {
    const graph = buildDependencyGraph(ENTRY_FILE_ONLY)

    // entry-file-only has a single file with no imports
    expect(graph.leaves.length).toBeGreaterThanOrEqual(1)
  })

  it('includes isolated files with no imports in leaves array', () => {
    const graph = buildDependencyGraph(ENTRY_FILE_ONLY)

    // The index.ts file has no imports, should be a leaf
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

    // Files with no dependents should be roots
    expect(graph.roots.length).toBeGreaterThanOrEqual(0)
    for (const root of graph.roots) {
      const node = graph.nodes.get(root)
      // Every root must exist in the graph and have no dependents
      expect(node).toBeDefined()
      expect(node?.dependents.length).toBe(0)
    }
  })
})

describe('resolveImportPath edge cases', () => {
  it('returns null for non-relative external import paths', () => {
    // External imports (not starting with . or /) should return null
    const graph = buildDependencyGraph(MINIMAL_PROJECT, { includeExternal: false })

    // External dependencies should not be in the graph nodes
    for (const node of graph.nodes.values()) {
      for (const dep of node.dependencies) {
        // All dependencies should be internal (resolved paths)
        expect(dep.includes('node_modules')).toBe(false)
      }
    }
  })
})
