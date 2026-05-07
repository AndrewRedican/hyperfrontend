import type { MemoryMonitor } from '../../memory/monitor'
import type { BuildContext, WorkspaceBundledDep } from '../../models'
import type { PrePassJob } from '../dependencies/pre-pass'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger } from '@hyperfrontend/logging'
import { join } from '@hyperfrontend/project-scope/core'
import { buildWorkspaceRoutes } from '../dependencies/externalize-plugin'
import { resolveDefaultWorkerPath, runPrePass } from '../dependencies/pre-pass'
import { resolveDepEntry } from '../dependencies/resolve-dep-entry'

const log = logger.channel('builder:bundle:declarations:dts-pre-pass')

const collectWorkspacePrefixDeps = (context: BuildContext): string[] => {
  const set = createSet<string>([])
  for (const entry of context.workspaceBundledDeps) {
    if (entry.policy === 'whole-surface') set.add(entry.packageName)
  }
  return from(set)
}

const collectWorkspaceExactSpecifiers = (context: BuildContext): string[] => {
  const set = createSet<string>([])
  for (const entry of context.workspaceBundledDeps) {
    if (entry.policy === 'sub-path') set.add(entry.specifier)
  }
  return from(set)
}

const workspaceDtsOutputFile = (entry: BuildContext['workspaceBundledDeps'][number]): string =>
  entry.subPath ? `${entry.specifier}/index.d.ts` : `${entry.packageName}/index.d.ts`

const filterRouteEntries = (entry: WorkspaceBundledDep, all: WorkspaceBundledDep[]): WorkspaceBundledDep[] =>
  all.filter((other) => (entry.policy === 'sub-path' ? other.specifier !== entry.specifier : other.packageName !== entry.packageName))

const buildJobs = (deps: string[], context: BuildContext): PrePassJob[] => {
  const depsRoot = join(context.outputPath, '_dependencies')
  const jobs: PrePassJob[] = []
  const workspacePrefixDeps = collectWorkspacePrefixDeps(context)
  const workspaceExactSpecifiers = collectWorkspaceExactSpecifiers(context)
  const workspaceRoutes = buildWorkspaceRoutes(context.workspaceBundledDeps)
  for (const dep of deps) {
    let inputPath: string
    try {
      inputPath = resolveDepEntry({ dep, projectRoot: context.projectRoot, workspaceRoot: context.workspaceRoot, kind: 'dts' })
    } catch (error) {
      log.warn(`skipping d.ts pre-pass for ${dep}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    const otherNpmDeps = deps.filter((d) => d !== dep)
    jobs.push({
      kind: 'dts',
      dep,
      inputPath,
      format: 'esm',
      outputPath: join(depsRoot, dep, 'index.d.ts'),
      otherDeps: [...otherNpmDeps, ...workspacePrefixDeps],
      otherWorkspaceSpecifiers: workspaceExactSpecifiers,
      npmDeps: otherNpmDeps,
      workspaceRoutes,
      depsRoot,
    })
  }
  return jobs
}

const buildWorkspaceJobs = (context: BuildContext, npmDeps: string[]): PrePassJob[] => {
  if (context.workspaceBundledDeps.length === 0) return []
  const depsRoot = join(context.outputPath, '_dependencies')
  const wholeSurface = collectWorkspacePrefixDeps(context)
  const subPathSpecifiers = collectWorkspaceExactSpecifiers(context)
  const jobs: PrePassJob[] = []
  for (const entry of context.workspaceBundledDeps) {
    const otherWorkspacePackages = wholeSurface.filter((name) => name !== entry.packageName || entry.policy === 'sub-path')
    const otherSubPathSpecifiers = subPathSpecifiers.filter((spec) => spec !== entry.specifier)
    const workspaceRoutes = buildWorkspaceRoutes(filterRouteEntries(entry, context.workspaceBundledDeps))
    jobs.push({
      kind: 'workspace-dts',
      dep: entry.specifier,
      inputPath: entry.inputPath,
      format: 'esm',
      outputPath: join(depsRoot, workspaceDtsOutputFile(entry)),
      otherDeps: [...npmDeps, ...otherWorkspacePackages],
      otherWorkspaceSpecifiers: otherSubPathSpecifiers,
      tsConfigPath: entry.tsConfigPath,
      workspaceRoot: context.workspaceRoot,
      npmDeps,
      workspaceRoutes,
      depsRoot,
    })
  }
  return jobs
}

/**
 * Runs the d.ts pre-pass: for each bundled dep, produces `_dependencies/<dep>/index.d.ts`
 * by running `rollup-plugin-dts` over the dep's types entry. Cross-dep type imports are
 * marked external so the per-entry d.ts pass can route them through `_dependencies/`.
 *
 * Mirrors the JS pre-pass model — each rollup invocation runs in a forked Node child
 * process to keep peak heap bounded (~1.5 GB ceiling per worker).
 *
 * @param context - Resolved build context.
 * @param monitor - Optional memory monitor invoked between jobs.
 * @throws {Error} When the worker artifact cannot be located, or when any d.ts job fails.
 *
 * @example Producing _dependencies/<dep>/index.d.ts for a self-contained build
 * ```typescript
 * await runDtsPrePass(context)
 * ```
 */
export const runDtsPrePass = async (context: BuildContext, monitor?: MemoryMonitor): Promise<void> => {
  if (context.bundledDeps.length === 0 && context.workspaceBundledDeps.length === 0) return
  const invocation = resolveDefaultWorkerPath(context.workspaceRoot)
  if (!invocation) {
    throw createError('bundleAllDeps is enabled but the pre-pass worker artifact was not found for the d.ts pre-pass.')
  }
  const npmJobs = buildJobs(context.bundledDeps, context)
  const workspaceJobs = buildWorkspaceJobs(context, context.bundledDeps)
  const jobs = [...npmJobs, ...workspaceJobs]
  if (jobs.length === 0) {
    log.debug('d.ts pre-pass: no eligible deps (all skipped due to missing types)')
    return
  }
  log.info(`d.ts pre-pass: ${npmJobs.length} npm + ${workspaceJobs.length} workspace = ${jobs.length} job(s)`)
  monitor?.check('bundle:declarations:dts-prepass:start')
  await runPrePass(jobs, { workerPath: invocation.path, execArgv: invocation.execArgv, monitor })
  monitor?.check('bundle:declarations:dts-prepass:end')
}
