/**
 * The `service` executor: builds a service into one CommonJS main with every package inlined,
 * the manifest of its immutable section, its assets and a release manifest, sealed by the kernel
 * the service is written on so that the built service refuses to boot beside changed bytes.
 *
 * @module executors/service/executor
 */

import type { Executor } from '../../runner/contract'
import type { ServiceExecutorOptions } from './options'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describeError, refusal } from '../../runner/refusal'
import { logger } from '../shared/logger'
import { resolveFromWorkspace } from '../shared/workspace'
import { bundleMain, mainBanner, mainDescriptor, runsThroughRunner } from './bundle'
import { loadServiceConfig } from './config'
import { loadKernel, releaseProblems } from './kernel'
import { serializeServiceManifest } from './manifest'
import { requiredFiles, servicePlan, workspacePath } from './options-check'
import {
  checkOutput,
  collectAssets,
  copyServiceAssets,
  discardOutput,
  MAIN_FILE,
  startOutput,
  RELEASE_MANIFEST_FILE,
  SERVICE_MANIFEST_FILE,
} from './output'
import { importMetaProblems } from './sources'

/**
 * Throws one refusal listing every problem, when there is one.
 *
 * @param header - The line the problems are listed under
 * @param problems - The problems, one line each
 * @throws {Error} A refusal, when the list holds a problem
 */
function refuseAny(header: string, problems: readonly string[]): void {
  if (problems.length > 0) throw refusal([header, ...problems.map((problem) => `  - ${problem}`)].join('\n'))
}

/**
 * Imports a module by its file, outside the graph of this package.
 *
 * @param file - The file, absolute
 * @returns The module
 */
function importFile(file: string): Promise<unknown> {
  return import(/* hf-graph: opaque */ pathToFileURL(file).href)
}

/**
 * Builds a service: one CommonJS main, `service.manifest.json`, the assets and `hf-release.json`.
 *
 * @param options - The output directory, the TypeScript configuration and the assets
 * @param context - The workspace, the project and the target the task runs on
 * @returns Whether the build succeeded
 *
 * @example A `build` target that copies a directory of assets beside the main
 * ```json
 * {
 *   "targets": {
 *     "build": {
 *       "executor": "@hyperfrontend/workspace:service",
 *       "options": { "assets": ["assets/**"] }
 *     }
 *   }
 * }
 * ```
 * Run with `npx hf run hello:build`; the service lands in `dist/apps/hello` and starts with `node dist/apps/hello/main.cjs`.
 */
export const serviceExecutor: Executor<ServiceExecutorOptions> = async (options, context) => {
  const project = context.projectName

  logger.setLogLevel(options.verbose ? 'debug' : 'log')

  if (!project) {
    logger.error('Project name is required')
    return { success: false }
  }
  if (!context.projects[project]) {
    logger.error(`Could not find project configuration for ${project}`)
    return { success: false }
  }

  let written: readonly [directory: string, label: string] | null = null
  try {
    const plan = servicePlan({ ...options }, context)
    const identity = requiredFiles(plan)
    refuseAny(
      `${project} cannot be built as its sources stand:`,
      importMetaProblems(plan.sourceRoot, plan.workspaceRoot, [plan.configFile])
    )
    const immutable =
      (await loadServiceConfig(plan.configFile, workspacePath(plan.workspaceRoot, plan.configFile), importFile)).immutable ?? {}
    const kernel = await loadKernel(project, plan.projectRoot, resolveFromWorkspace, importFile)
    const seal = kernel.sealServiceBuild(immutable)
    const assets = collectAssets(plan.sourceRoot, plan.assets)
    refuseAny(`Invalid options of ${plan.task}:`, assets.problems)
    const release = { root: plan.outputPath, name: identity.name, version: identity.version }
    refuseAny(
      `${project} cannot be released under the name and version of ${workspacePath(plan.workspaceRoot, join(plan.projectRoot, 'package.json'))} with the assets it copies:`,
      releaseProblems(kernel, release, [MAIN_FILE, SERVICE_MANIFEST_FILE, ...assets.files])
    )

    const outputLabel = workspacePath(plan.workspaceRoot, plan.outputPath)
    checkOutput(plan.outputPath, outputLabel, identity.name)
    // why: from here on the directory is this build's to remove, a failure while it is emptied included
    written = [plan.outputPath, outputLabel]
    startOutput(plan.outputPath, identity.name)
    const banner = mainBanner(seal)
    await bundleMain(mainDescriptor(plan, banner), `service:${project}`)
    if (!runsThroughRunner(readFileSync(join(plan.outputPath, MAIN_FILE), 'utf8'), banner, seal.key)) {
      throw refusal(
        `${workspacePath(plan.workspaceRoot, plan.entry)} does not run the service through runService of @hyperfrontend/server, so the built service would start unchecked.`
      )
    }
    copyServiceAssets(plan, assets.files)
    writeFileSync(join(plan.outputPath, SERVICE_MANIFEST_FILE), serializeServiceManifest(immutable, seal.digest))

    const manifest = kernel.createReleaseManifest(release)
    const releaseText = kernel.serializeReleaseManifest(manifest)
    writeFileSync(join(plan.outputPath, RELEASE_MANIFEST_FILE), releaseText)
    refuseAny(
      `the release of ${project} does not verify against the directory the build wrote:`,
      kernel.verifyRelease(plan.outputPath, manifest).map((issue) => issue.message)
    )
    // why: the line is the build's result, which a script reads and an operator compares with the started line of the running service, so it goes out as it is, outside the logger's levels and prefixes
    process.stdout.write(`built ${project} release=${kernel.releaseManifestDigest(releaseText)} immutable=${seal.digest}\n`)
    return { success: true }
  } catch (error) {
    // why: what failed is reported first, and a directory that could not be removed is said last, since it then holds an unfinished build
    const left = written === null ? '' : discardOutput(...written)
    const text = describeError(error)
    if (error instanceof Error && text !== error.message) {
      logger.error(`Failed to build ${project}`)
      logger.error(`Error: ${error.message}${left}`)
      logger.debug(`Stack trace:\n${text}`)
    } else {
      logger.error(`${text}${left}`)
    }
    return { success: false }
  }
}
