import { cpSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** The generated declarations mirroring `@nx/devkit`, in this repository. */
const COMPAT_SOURCE = join(import.meta.dirname, '..', '..', '..', '..', '..', 'libs', 'integrations', 'nx', 'src', 'compat')

/** The declaration files of the generated set. */
const COMPAT_FILES = ['index.ts', 'executor.ts', 'graph.ts', 'plugin.ts', 'tree.ts']

// why: each assignment fails the type check when the generated declarations or the published plugin drift from the devkit installed beside them.
const PROBE = `import type {
  ExecutorContext as DevkitExecutorContext,
  Generator as DevkitGenerator,
  ProjectGraph as DevkitProjectGraph,
  PromiseExecutor as DevkitPromiseExecutor,
  Tree as DevkitTree,
} from '@nx/devkit'
import type { BuildExecutorSchema, runBuildExecutor } from '@hyperfrontend/features/nx/executors'
import type { FeatureGeneratorSchema, InitGeneratorSchema, featureGenerator, initGenerator } from '@hyperfrontend/features/nx/generators'
import type { ExecutorContext, ProjectGraph, PromiseExecutor, Tree } from './compat/index'

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
  nxJsonConfiguration: { targetDefaults: { build: {} } },
  projectGraph: { nodes: {}, dependencies: {} },
}

export const witnesses = [
  fixture satisfies ExecutorContext,
  fixture satisfies DevkitExecutorContext,
  {} as DevkitExecutorContext satisfies ExecutorContext,
  {} as DevkitProjectGraph satisfies ProjectGraph,
  {} as DevkitTree satisfies Tree,
  {} as Tree satisfies DevkitTree,
  {} as PromiseExecutor<{ verbose?: boolean }> satisfies DevkitPromiseExecutor<{ verbose?: boolean }>,
  {} as typeof initGenerator satisfies DevkitGenerator<InitGeneratorSchema>,
  {} as typeof featureGenerator satisfies DevkitGenerator<FeatureGeneratorSchema>,
  {} as typeof runBuildExecutor satisfies DevkitPromiseExecutor<BuildExecutorSchema>,
]
`

/** The probe's compiler options: the consumer's own resolution of package exports, strict. */
const TSCONFIG = {
  compilerOptions: {
    strict: true,
    noEmit: true,
    module: 'preserve',
    moduleResolution: 'bundler',
    target: 'es2022',
    skipLibCheck: true,
    types: ['node'],
  },
  files: ['probe.ts'],
}

/**
 * Writes the type probe into a consumer workspace: the generated declarations, the assignments
 * against the installed `@nx/devkit` and the published plugin, and the compiler options.
 *
 * @param workspaceDir - The consumer workspace
 * @returns The probe's tsconfig, relative to the workspace
 */
export function writeTypesProbe(workspaceDir: string): string {
  const probeDir = join(workspaceDir, 'nx-types-probe')
  for (const file of COMPAT_FILES) cpSync(join(COMPAT_SOURCE, file), join(probeDir, 'compat', file))
  writeFileSync(join(probeDir, 'probe.ts'), PROBE)
  writeFileSync(join(probeDir, 'tsconfig.json'), `${JSON.stringify(TSCONFIG, null, 2)}\n`)
  return join('nx-types-probe', 'tsconfig.json')
}
