import type { ExecutorContext } from '../model'
import { join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * Resolve the absolute working directory of the executing project.
 *
 * The SDK command runners are `cwd`-based; this maps an Nx executor context to
 * the project root those runners resolve config and output paths against.
 *
 * @param context - The Nx executor context for the running target.
 * @returns The absolute path to the executing project's root directory.
 * @throws {Error} When no project name or project configuration is available.
 *
 * @example Resolve the cwd for a build target
 * ```ts
 * const cwd = resolveProjectCwd(context) // '/workspace/libs/clock'
 * ```
 */
export function resolveProjectCwd(context: ExecutorContext): string {
  const { projectName } = context
  if (projectName === undefined) {
    throw createError('An executing project name is required.')
  }
  const projectConfig = context.projectsConfigurations?.projects[projectName]
  if (projectConfig === undefined) {
    throw createError(`Could not find project configuration for ${projectName}.`)
  }
  return join(context.root, projectConfig.root)
}
