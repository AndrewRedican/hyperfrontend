import type { TypesExtractConfig } from './src/types-extract/config'

/**
 * The upstream-compatible declarations the workspace carries in `@hyperfrontend/integration-nx/compat`
 * instead of depending on `@nx/devkit` types: what is read from Nx, at which tag, how deep, and what
 * is never carried.
 */
const config: TypesExtractConfig = {
  lockFile: 'tools/workspace/types-extract.lock.json',
  sources: {
    nx: { repo: 'nrwl/nx', ref: '23.3.0', include: ['packages/nx/src/'] },
  },
  requests: [
    {
      source: 'nx',
      root: 'packages/nx/src/config/misc-interfaces.ts',
      symbols: ['ExecutorContext', 'PromiseExecutor', 'AsyncIteratorExecutor', 'Executor', 'Generator', 'GeneratorCallback'],
      depth: 2,
      output: 'libs/integrations/nx/src/compat/executor.ts',
    },
    {
      source: 'nx',
      root: 'packages/nx/src/config/project-graph.ts',
      symbols: ['ProjectGraph', 'ProjectGraphProjectNode', 'ProjectGraphExternalNode', 'ProjectGraphDependency', 'DependencyType'],
      depth: 3,
      output: 'libs/integrations/nx/src/compat/graph.ts',
    },
    {
      source: 'nx',
      root: 'packages/nx/src/generators/tree.ts',
      symbols: ['Tree', 'FileChange', 'TreeWriteOptions'],
      depth: 1,
      output: 'libs/integrations/nx/src/compat/tree.ts',
    },
    {
      source: 'nx',
      root: 'packages/nx/src/project-graph/plugins/public-api.ts',
      symbols: ['CreateNodesV2', 'CreateNodesFunctionV2', 'CreateNodesContextV2', 'CreateNodesResultV2', 'CreateNodesResult'],
      depth: 2,
      output: 'libs/integrations/nx/src/compat/plugin.ts',
    },
  ],
  boundary: {
    default: 'unknown',
    // why: the executors read a target's defaults and a project's root and targets; the release, sync, migrate and installation settings and the package manifest shape are Nx's own concern and change with every minor, so they are carried as `object`, which every upstream interface satisfies.
    overrides: {
      NxInstallationConfiguration: 'object',
      NxMigrateConfiguration: 'object',
      NxReleaseConfiguration: 'object',
      NxReleaseDockerConfiguration: 'object',
      NxReleaseVersionConfiguration: 'object',
      NxSyncConfiguration: 'object',
      PackageJson: 'object',
    },
  },
  header: {
    // why: the barrel is linted, and a bare package scope in a JSDoc block would be rewritten by the escape-package-tags fixer.
    tool: 'the types-extract tool of tools/workspace',
    regenerate: 'npm run hf -- run tool-workspace:types-extract',
    check: 'npm run hf -- run tool-workspace:types-extract-check',
  },
  index: 'libs/integrations/nx/src/compat/index.ts',
  indexModule: '@hyperfrontend/integration-nx/compat',
  report: 'libs/integrations/nx/src/compat/REPORT.md',
  notice: 'libs/integrations/nx/src/compat/NOTICE.md',
}

export default config
