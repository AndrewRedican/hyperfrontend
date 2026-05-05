import type { MemoryMonitor } from '../../memory/monitor'
import type { BuildContext } from '../../models'
import type { PrePassJob } from '../dependencies/pre-pass'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { logger } from '@hyperfrontend/logging'
import { join } from '@hyperfrontend/project-scope/core'
import { resolveDefaultWorkerPath, runPrePass } from '../dependencies/pre-pass'
import { resolveDepEntry } from '../dependencies/resolve-dep-entry'

const log = logger.channel('builder:bundle:declarations:dts-pre-pass')

const buildJobs = (deps: string[], context: BuildContext): PrePassJob[] => {
  const depsRoot = join(context.outputPath, '_dependencies')
  const jobs: PrePassJob[] = []
  for (const dep of deps) {
    let inputPath: string
    try {
      inputPath = resolveDepEntry({ dep, projectRoot: context.projectRoot, workspaceRoot: context.workspaceRoot, kind: 'dts' })
    } catch (error) {
      log.warn(`skipping d.ts pre-pass for ${dep}: ${error instanceof Error ? error.message : String(error)}`)
      continue
    }
    jobs.push({
      kind: 'dts',
      dep,
      inputPath,
      format: 'esm',
      outputPath: join(depsRoot, dep, 'index.d.ts'),
      otherDeps: deps.filter((d) => d !== dep),
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
 * process to keep peak heap below ~1.5 GB (Decision #44).
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
  if (context.bundledDeps.length === 0) return
  const invocation = resolveDefaultWorkerPath(context.workspaceRoot)
  if (!invocation) {
    throw createError('bundleAllDeps is enabled but the pre-pass worker artifact was not found for the d.ts pre-pass.')
  }
  const jobs = buildJobs(context.bundledDeps, context)
  if (jobs.length === 0) {
    log.debug('d.ts pre-pass: no eligible deps (all skipped due to missing types)')
    return
  }
  log.info(`d.ts pre-pass: ${jobs.length} job(s)`)
  monitor?.check('bundle:declarations:dts-prepass:start')
  await runPrePass(jobs, { workerPath: invocation.path, execArgv: invocation.execArgv, monitor })
  monitor?.check('bundle:declarations:dts-prepass:end')
}
