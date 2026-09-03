import ts from 'typescript'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { min } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger } from '@hyperfrontend/logging'
import { exists, getDirname, readFileContent, writeFileContent } from '@hyperfrontend/project-scope/core'
import { getRequireSpecifier, parseChunk, resolveRelativeTarget } from './ast-utils'
import { destructureRequires } from './destructure-requires'
import { walkFiles } from './orphan-chunks'
import { hasDynamicSpecifier } from './specifiers'

const log = logger.channel('builder:bundle:dependencies:prune')

const CJS_CHUNK = 'index.cjs.js'

/** A node on the explicit Tarjan work stack, tracking its position in its neighbor list. */
interface TarjanFrame {
  /** Chunk path this frame is visiting. */
  node: string
  /** The chunk's out-edges (required chunks). */
  neighbors: string[]
  /** Index of the next neighbor to descend into. */
  cursor: number
}

/**
 * Aggregate result of the require-destructuring pass.
 */
export interface DestructureRequiresResult {
  /** Whole-module `const NS = require(...)` bindings collapsed to destructures. */
  requireBindingsDestructured: number
}

const collectRequireTargets = (source: string, chunkDir: string, chunkSet: Set<string>): Set<string> => {
  const sourceFile = parseChunk(source)
  const targets = createSet<string>([])
  const visit = (node: ts.Node): void => {
    const specifier = getRequireSpecifier(node)
    if (specifier !== null) {
      const target = resolveRelativeTarget(chunkDir, specifier)
      if (target !== null && chunkSet.has(target)) targets.add(target)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return targets
}

const buildRequireGraph = (chunks: string[], chunkSet: Set<string>): Map<string, Set<string>> => {
  const graph = createMap<string, Set<string>>()
  for (const chunk of chunks) graph.set(chunk, collectRequireTargets(readFileContent(chunk), getDirname(chunk), chunkSet))
  return graph
}

/**
 * Assigns every chunk a strongly-connected-component id via iterative Tarjan, so
 * a require edge `importer → target` is a cycle exactly when both share an id.
 *
 * Iterative (explicit work stack) to stay safe on deep require chains; the graph
 * is the relative-require graph restricted to chunks under `_dependencies/`.
 *
 * @param nodes - All chunk paths, in a stable order.
 * @param graph - Adjacency from each chunk to the chunks it requires.
 * @returns Map from chunk path to its SCC id.
 */
const computeSccIds = (nodes: string[], graph: Map<string, Set<string>>): Map<string, number> => {
  const index = createMap<string, number>()
  const low = createMap<string, number>()
  const onStack = createSet<string>([])
  const componentOf = createMap<string, number>()
  const tarjanStack: string[] = []
  // why: invariants guarantee every node read below was opened (written) first, so the cast is total.
  const idxOf = (node: string): number => index.get(node) as number
  const lowOf = (node: string): number => low.get(node) as number
  // why: the graph holds an entry for every node, so the lookup always resolves.
  const neighborsOf = (node: string): string[] => [...(graph.get(node) as Set<string>)]
  let counter = 0
  let component = 0
  const open = (node: string): void => {
    index.set(node, counter)
    low.set(node, counter)
    counter += 1
    tarjanStack.push(node)
    onStack.add(node)
  }
  for (const start of nodes) {
    if (index.has(start)) continue
    open(start)
    const work: TarjanFrame[] = [{ node: start, neighbors: neighborsOf(start), cursor: 0 }]
    while (work.length > 0) {
      const frame = work[work.length - 1] as TarjanFrame
      if (frame.cursor < frame.neighbors.length) {
        const next = frame.neighbors[frame.cursor] as string
        frame.cursor += 1
        if (!index.has(next)) {
          open(next)
          work.push({ node: next, neighbors: neighborsOf(next), cursor: 0 })
        } else if (onStack.has(next)) low.set(frame.node, min(lowOf(frame.node), idxOf(next)))
        continue
      }
      if (lowOf(frame.node) === idxOf(frame.node)) {
        for (;;) {
          const popped = tarjanStack.pop() as string
          onStack.delete(popped)
          componentOf.set(popped, component)
          if (popped === frame.node) break
        }
        component += 1
      }
      work.pop()
      const parent = work[work.length - 1]
      if (parent) low.set(parent.node, min(lowOf(parent.node), lowOf(frame.node)))
    }
  }
  return componentOf
}

/**
 * Collapses whole-module CJS require bindings (`const NS = require('./rel')`) to
 * destructuring binds across the surviving `_dependencies/` chunks, guarded so it
 * never destructures across a `require` cycle.
 *
 * Builds the relative-require graph over the CJS chunks, finds its
 * strongly-connected components, and lets each chunk destructure a target only
 * when the two sit in different components, i.e. the edge is acyclic, so an
 * eager destructure cannot capture an export before a circular dependency
 * finished initializing (the exact hazard rollup's namespace-access codegen
 * avoids). ESM chunks need nothing: their named imports already destructure. A
 * dynamic `import(`/`require(` anywhere disables the pass for safety, since it
 * could hide a cycle the static graph cannot see.
 *
 * @param depsRoot - Absolute path to the `_dependencies/` directory.
 * @returns Count of require bindings destructured.
 *
 * @example Running the pass after the strip/orphan passes
 * ```typescript
 * const { requireBindingsDestructured } = destructureRequiresPass(depsRootOf(context))
 * ```
 */
export const destructureRequiresPass = (depsRoot: string): DestructureRequiresResult => {
  const result: DestructureRequiresResult = { requireBindingsDestructured: 0 }
  if (!exists(depsRoot)) return result
  const chunks: string[] = []
  walkFiles(depsRoot, (name) => name === CJS_CHUNK, chunks)
  if (chunks.length === 0) return result
  const sources = createMap<string, string>()
  for (const chunk of chunks) {
    const source = readFileContent(chunk)
    // why: a dynamic specifier could hide a require cycle the static graph misses; bail the whole pass, mirroring the orphan sweep's safety posture.
    if (hasDynamicSpecifier(source)) {
      log.warn(`dynamic import/require in ${chunk}; skipping require-destructure pass for safety`)
      return result
    }
    sources.set(chunk, source)
  }
  const chunkSet = createSet<string>(chunks)
  const graph = buildRequireGraph(chunks, chunkSet)
  const componentOf = computeSccIds(chunks, graph)
  for (const chunk of chunks) {
    // why: every chunk was just read into `sources` above, so the lookup always resolves.
    const source = sources.get(chunk) as string
    const myComponent = componentOf.get(chunk)
    const isSafeTarget = (target: string): boolean => chunkSet.has(target) && componentOf.get(target) !== myComponent
    const rewritten = destructureRequires(source, getDirname(chunk), isSafeTarget)
    if (!rewritten) continue
    writeFileContent(chunk, rewritten.code)
    result.requireBindingsDestructured += rewritten.rewrittenBindings
  }
  return result
}
