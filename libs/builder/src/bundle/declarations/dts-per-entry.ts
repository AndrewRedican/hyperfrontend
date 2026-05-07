import type { MemoryMonitor } from '../../memory/monitor'
import type { BuildContext, EntryPoint } from '../../models'
import type { PrePassJob, SiblingEntryDescriptor } from '../dependencies/pre-pass'
import { from } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { logger } from '@hyperfrontend/logging'
import { exists } from '@hyperfrontend/project-scope/core/fs'
import { resolveDefaultWorkerPath, runPrePass } from '../dependencies/pre-pass'
import { dtsPathFor } from './sibling-resolver'

const log = logger.channel('builder:bundle:declarations:dts-per-entry')

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

const buildSiblingDescriptors = (entries: EntryPoint[], context: BuildContext, currentSrcPath: string): SiblingEntryDescriptor[] => {
  const descriptors: SiblingEntryDescriptor[] = []
  for (const entry of entries) {
    if (entry.srcPath === currentSrcPath) continue
    const indexDtsPath = dtsPathFor(context.outputPath, entry.srcPath)
    if (!exists(indexDtsPath)) continue
    descriptors.push({ srcPath: entry.srcPath, indexDtsPath })
  }
  return descriptors
}

const buildJobs = (entries: EntryPoint[], context: BuildContext): PrePassJob[] => {
  const jobs: PrePassJob[] = []
  const workspacePrefixDeps = collectWorkspacePrefixDeps(context)
  const workspaceExactSpecifiers = collectWorkspaceExactSpecifiers(context)
  for (const entry of entries) {
    const inputPath = dtsPathFor(context.outputPath, entry.srcPath)
    if (!exists(inputPath)) continue
    const siblingEntries = buildSiblingDescriptors(entries, context, entry.srcPath)
    jobs.push({
      kind: 'dts',
      dep: entry.exportPath,
      inputPath,
      format: 'esm',
      outputPath: inputPath,
      otherDeps: [...context.bundledDeps, ...workspacePrefixDeps],
      otherWorkspaceSpecifiers: workspaceExactSpecifiers,
      siblingEntries,
      selfDtsPath: inputPath,
      selfSrcPath: entry.srcPath,
    })
  }
  return jobs
}

/**
 * Runs the per-entry d.ts inlining pass: re-runs `rollup-plugin-dts` over every
 * tsc-emitted entry `.d.ts` so bundled-dep type imports are routed through
 * `_dependencies/<dep>/index.d.ts` rather than left as bare specifiers.
 *
 * Each rollup invocation runs in a forked Node child to bound peak heap.
 * Entries whose tsc output is missing are skipped silently — the bundle phase
 * may have skipped them deliberately (e.g., empty bundles).
 *
 * @param context - Resolved build context.
 * @param monitor - Optional memory monitor invoked between jobs.
 * @throws {Error} When the worker artifact cannot be located, or when any per-entry job fails.
 *
 * @example Inlining bundled-dep types into every entry's .d.ts after tsc emission
 * ```typescript
 * await runDtsPerEntry(context)
 * ```
 */
export const runDtsPerEntry = async (context: BuildContext, monitor?: MemoryMonitor): Promise<void> => {
  if (context.bundledDeps.length === 0) return
  const invocation = resolveDefaultWorkerPath(context.workspaceRoot)
  if (!invocation) {
    throw createError('bundleAllDeps is enabled but the pre-pass worker artifact was not found for the per-entry d.ts pass.')
  }
  const jobs = buildJobs(context.entryPointDiscovery.entryPoints, context)
  if (jobs.length === 0) {
    log.debug('per-entry d.ts pass: no entries with tsc-emitted .d.ts files')
    return
  }
  log.info(`per-entry d.ts pass: ${jobs.length} entries`)
  monitor?.check('bundle:declarations:dts-perentry:start')
  await runPrePass(jobs, { workerPath: invocation.path, execArgv: invocation.execArgv, monitor })
  monitor?.check('bundle:declarations:dts-perentry:end')
}
