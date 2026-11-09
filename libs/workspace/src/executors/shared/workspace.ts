/**
 * What the executors ask of the workspace a task runs in: where one of its packages lives as
 * that workspace resolves it, where a project's build writes, and which packages are its own.
 *
 * @module executors/shared/workspace
 */

import type { ProjectConfiguration } from '../../runner/contract'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readJson } from '../../graph/workspace'

/** The target whose output a package is packed, tested and published from. */
export const BUILD_TARGET = 'build'

// why: the CommonJS build of this module has no import.meta.dirname, and the ES module, which the specs load, has no __dirname
/* node:coverage ignore next 1 */
const MODULE_DIRECTORY = typeof __dirname === 'string' ? __dirname : import.meta.dirname

/**
 * The file a module specifier names, resolved from the engine's own installation: a dependency
 * this package declares is found wherever npm placed it, nested beside the package or hoisted
 * above it, before anything the workspace installs for itself.
 *
 * @param specifier - The module, such as `typescript/bin/tsc`
 * @param from - The directory the lookup climbs from; this module's own when omitted
 * @returns The file, or null when nothing above the directory resolves the module
 *
 * @example The compiler the engine depends on, whatever TypeScript the workspace installed
 * ```typescript
 * resolveFromEngine('typescript/bin/tsc')
 * // => '/repo/node_modules/@hyperfrontend/workspace/node_modules/typescript/bin/tsc' when the workspace's own TypeScript is another major
 * // => '/repo/node_modules/typescript/bin/tsc' when npm hoisted one TypeScript for both
 * ```
 */
export function resolveFromEngine(specifier: string, from: string = MODULE_DIRECTORY): string | null {
  try {
    return createRequire(join(from, 'package.json')).resolve(specifier)
  } catch {
    return null
  }
}

/**
 * The file a module specifier names, resolved from the workspace root the way any module of the
 * workspace resolves it: through the workspace's path aliases where the process installed them,
 * else from the workspace's `node_modules`.
 *
 * @param root - The workspace root, absolute
 * @param specifier - The module, such as `@scope/package/entry`
 * @returns The file, or null when the workspace cannot resolve the module
 *
 * @example A tool the workspace installs, run on the current Node.js
 * ```typescript
 * import { execFileSync } from 'node:child_process'
 *
 * const tsc = resolveFromWorkspace(context.root, 'typescript/bin/tsc')
 * // => '/repo/node_modules/typescript/bin/tsc', or null when the workspace has no TypeScript
 * if (tsc !== null) execFileSync(process.execPath, [tsc, '--noEmit', '-p', 'libs/core/tsconfig.lib.json'], { cwd: context.root, stdio: 'inherit' })
 * ```
 */
export function resolveFromWorkspace(root: string, specifier: string): string | null {
  try {
    return createRequire(join(root, 'package.json')).resolve(specifier)
  } catch {
    return null
  }
}

/**
 * Where a project's build writes: the `outputPath` its `build` target runs with, else
 * `dist/<project root>`.
 *
 * @param root - The workspace root, absolute
 * @param project - The project's configuration, its targets resolved
 * @returns The output directory, absolute
 *
 * @example The directory the build of a project wrote
 * ```typescript
 * buildOutputOf(context.root, context.projects['lib-core'])
 * // => '/repo/dist/libs/core' by default
 * // => '/repo/dist/packages/core' when the build target's options set outputPath: 'dist/packages/core'
 * ```
 */
export function buildOutputOf(root: string, project: ProjectConfiguration): string {
  const configured = project.targets?.[BUILD_TARGET]?.options?.['outputPath']
  return join(root, typeof configured === 'string' ? configured : join('dist', project.root))
}

/** A manifest, as far as its name is read. */
interface NamedManifest {
  /** The package's name. */
  readonly name?: string
}

/**
 * The names of the packages the workspace's own projects carry.
 *
 * @param root - The workspace root, absolute
 * @param projects - Every project's configuration by name
 * @returns The name of each project's `package.json`, where it has one that names itself
 *
 * @example The first-party packages a build bundles rather than lists as dependencies
 * ```typescript
 * workspacePackages(context.root, context.projects)
 * // => ['@acme/core', '@acme/utils', '@acme/e2e-core']; a project without a package.json contributes nothing
 * ```
 */
export function workspacePackages(root: string, projects: Readonly<Record<string, ProjectConfiguration>>): string[] {
  return values(projects).flatMap((project) => {
    const name = readJson<NamedManifest>(join(root, project.root, 'package.json'))?.name
    return name === undefined ? [] : [name]
  })
}
