/**
 * The one job a service build hands the builder's Rollup worker: the service's main and every
 * package it imports, compiled into one CommonJS file that opens with the kernel's seal.
 *
 * @module executors/service/bundle
 */

import type { RollupBuildDescriptor } from '@hyperfrontend/builder/bundle/rollup'
import type { ServiceSeal } from './kernel'
import type { ServicePlan } from './options-check'
import { join } from 'node:path'
import { dispatchRollupWorker, resolveDefaultRollupWorkerPath } from '@hyperfrontend/builder/bundle/rollup'
import { refusal } from '../../runner/refusal'
import { MAIN_FILE } from './output'

/**
 * Writes the lines a built main opens with: the interpreter, the strict directive and the statement that stamps the build.
 *
 * @param seal - What the kernel gave for this build
 * @returns The banner, without a line feed at its end
 *
 * @example The top of a built main
 * ```typescript
 * mainBanner(seal)
 * // #!/usr/bin/env node
 * // 'use strict';
 * // globalThis[Symbol.for("@hyperfrontend/server/service-build")] = Object.freeze({ directory: __dirname, immutable: "<digest>" });
 * ```
 */
export function mainBanner(seal: ServiceSeal): string {
  // why: Rollup writes its own directive after the banner, where a statement in front of it makes it an expression, so the banner states the directive itself
  return ['#!/usr/bin/env node', "'use strict';", seal.statement].join('\n')
}

/**
 * Describes the bundle of a service for the builder's Rollup worker: one CommonJS main, every package inlined.
 *
 * @param plan - Where the build reads and writes
 * @param banner - The lines the main opens with
 * @returns The job, every path absolute
 *
 * @example The job of a service's main
 * ```typescript
 * mainDescriptor(plan, mainBanner(seal))
 * // => { format: 'cjs', inputFile: '/repo/apps/hello/src/main.ts', external: [], bin: { outputFile: '/repo/dist/apps/hello/main.cjs', ... }, ... }
 * ```
 */
export function mainDescriptor(plan: ServicePlan, banner: string): RollupBuildDescriptor {
  return {
    format: 'cjs',
    inputFile: plan.entry,
    outputDir: plan.outputPath,
    external: [],
    sourcemap: false,
    bundledDepsPlugin: null,
    workspaceRoutes: [],
    tsConfigPath: plan.tsConfigPath,
    projectRoot: plan.projectRoot,
    workspaceRoot: plan.workspaceRoot,
    bundleWorkspaceDeps: true,
    bundle: null,
    bin: { outputFile: join(plan.outputPath, MAIN_FILE), banner, footer: '', exports: 'auto', inlineDynamicImports: true, chmod: 0o755 },
    reportPath: '',
  }
}

/**
 * Runs the bundle of a service in the builder's Rollup worker.
 *
 * @param descriptor - The job
 * @param label - The name the job is logged under
 * @throws {Error} A refusal when the worker cannot be located beside the builder, and whatever the worker failed with
 *
 * @example Bundling the main of a service
 * ```typescript
 * await bundleMain(mainDescriptor(plan, mainBanner(seal)), 'service:hello')
 * // dist/apps/hello/main.cjs is written, executable
 * ```
 */
export async function bundleMain(descriptor: RollupBuildDescriptor, label: string): Promise<void> {
  const worker = resolveDefaultRollupWorkerPath()
  if (worker === undefined) {
    throw refusal(
      "the builder's rollup worker could not be located beside the builder module; the @hyperfrontend/workspace package appears incomplete."
    )
  }
  await dispatchRollupWorker(descriptor, { workerPath: worker.path, execArgv: worker.execArgv, label })
}

/**
 * Whether a built main runs through the kernel's runner: the text the build stamp is registered under occurs outside the banner, where only the runner's own code holds it.
 *
 * @param text - The built main
 * @param banner - The lines the build put at its top
 * @param key - The text the stamp is registered under
 * @returns True when the bundle holds the runner
 *
 * @example A main that never calls the runner
 * ```typescript
 * runsThroughRunner(`${banner}\nconsole.log('hello')\n`, banner, seal.key) // => false
 * ```
 */
export function runsThroughRunner(text: string, banner: string, key: string): boolean {
  return text.split(banner).join('').includes(key)
}
