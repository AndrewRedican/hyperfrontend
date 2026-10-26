import type {
  ExecutorContext as DevkitExecutorContext,
  ProjectGraph as DevkitProjectGraph,
  PromiseExecutor as DevkitPromiseExecutor,
  Tree as DevkitTree,
} from '@nx/devkit'
import type { ExecutorContext, ProjectGraph, PromiseExecutor, Tree } from './index'
import { describe, expect, it } from '@hyperfrontend/testing'

// why: the generated declarations mirror @nx/devkit structurally instead of depending on it; these compile-time assignments fail the type check if the generated subset ever drifts from the installed devkit. This spec is the one place a real Nx type appears.

/** A context an executor spec would hand-write; its inferred type must satisfy both the generated and the real type. */
const fixture = {
  root: '/workspace',
  projectName: 'lib-logging',
  targetName: 'build',
  cwd: '/workspace',
  isVerbose: false,
  projectsConfigurations: {
    version: 2,
    projects: { 'lib-logging': { root: 'libs/logging', targets: { build: { executor: '@hyperfrontend/package:build' } } } },
  },
  nxJsonConfiguration: { targetDefaults: { build: { cache: true } } },
  projectGraph: { nodes: {}, dependencies: {} },
}

/** The fixture satisfies the generated type. */
const fixtureAsCompat: ExecutorContext = fixture
/** The fixture satisfies the real type. */
const fixtureAsDevkit: DevkitExecutorContext = fixture
/** Inbound: the context Nx constructs satisfies the generated type, so every executor typed by it accepts what Nx hands over. */
const contextFromDevkit: ExecutorContext = {} as DevkitExecutorContext
/** Inbound: the graph Nx computes satisfies the generated one. */
const graphFromDevkit: ProjectGraph = {} as DevkitProjectGraph
/** Inbound: the tree Nx hands to generators satisfies the generated one. */
const treeFromDevkit: Tree = {} as DevkitTree
/** Outbound: the generated tree, carried without substitution, satisfies the real one. */
const treeToDevkit: DevkitTree = {} as Tree
// context: outbound, an executor written against the generated signature is one Nx can run.
const executorToDevkit: DevkitPromiseExecutor<{ verbose?: boolean }> = (async () => ({ success: true })) as PromiseExecutor<{
  verbose?: boolean
}>

describe('the generated compat declarations', () => {
  it('accept what the installed @nx/devkit constructs and type an executor Nx can run', () => {
    expect([
      fixtureAsCompat,
      fixtureAsDevkit,
      contextFromDevkit,
      graphFromDevkit,
      treeFromDevkit,
      treeToDevkit,
      executorToDevkit,
    ]).toHaveLength(7)
  })

  it('type a hand-written executor context without casts', () => {
    expect(fixtureAsCompat.projectsConfigurations.projects['lib-logging']?.root).toBe('libs/logging')
  })
})
