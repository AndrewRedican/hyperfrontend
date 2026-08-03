import type { GeneratorCallback, Tree } from '../../model'
import { ensureSdkDependency } from '../../shared/dependencies'
import { loadDevkit } from '../../shared/devkit'
import { installPackages } from '../../shared/install'
import { warnIfRollupBindingMissing } from '../../shared/rollup-binding'

/** Options for the `init` generator; mirrors `schema.json`. */
export interface InitGeneratorSchema {
  /** Keep an existing declaration's range untouched instead of pinning it to the running plugin's version. Defaults to `true`. */
  keepExistingVersions?: boolean
}

/**
 * Ensure the SDK package is declared in the consumer workspace's root
 * `package.json`; the `nx add` flow runs this generator after installing the
 * package.
 *
 * A declaration in any dependency section satisfies the check and is left in
 * its section untouched, so repeat runs are no-ops. When the package is
 * undeclared it is added to `dependencies` — the SDK is a runtime dependency —
 * pinned to a caret range on the running plugin's own version. Passing
 * `keepExistingVersions: false` instead re-pins an existing declaration in its
 * own section. When the consumer workspace has `@nx/devkit` installed, staged
 * files are formatted with it before Nx flushes them.
 *
 * All writes go through the tree, so `--dry-run` previews the manifest change
 * without touching the disk. The returned callback — which Nx runs only after
 * flushing real changes — installs dependencies only when the manifest
 * actually changed (via the consumer's `installPackagesTask` when resolvable,
 * else the built-in installer) and then verifies rollup's native platform
 * binding, printing the exact fix when it is missing.
 *
 * @param tree - The Nx virtual file-system tree for the consumer workspace.
 * @param options - Generator options; see {@link InitGeneratorSchema}.
 * @returns The post-flush callback that installs and runs the binding advisory.
 * @throws {Error} When the workspace root `package.json` is missing or malformed.
 *
 * @example Initialize a workspace after installing the package
 * ```bash
 * nx g @hyperfrontend/features:init
 * ```
 */
export async function initGenerator(tree: Tree, options: InitGeneratorSchema): Promise<GeneratorCallback> {
  const changed = ensureSdkDependency(tree, options)
  const devkit = loadDevkit(tree.root)
  if (devkit?.formatFiles !== undefined) {
    // why: formatting stages writes into the tree, and Nx locks the tree before callbacks run, so it must happen pre-flush.
    await devkit.formatFiles(tree)
  }
  return () => {
    if (changed) {
      if (devkit?.installPackagesTask !== undefined) {
        devkit.installPackagesTask(tree)
      } else {
        installPackages(tree)
      }
    }
    warnIfRollupBindingMissing(tree.root)
  }
}

export default initGenerator
