import type { Tree } from '../model'
import { execFileSync } from 'node:child_process'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { sdkInfo } from '../../shared/sdk-info'

/** Package managers detectable from a consumer workspace's lockfile. */
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun'

/** Reports whether a workspace-root-relative path exists. */
export type PathExists = (relativePath: string) => boolean

/**
 * Detect the consumer workspace's package manager from its lockfile.
 *
 * @param exists - Existence probe for workspace-root-relative paths.
 * @returns The detected package manager; `npm` when no known lockfile is found.
 *
 * @example Detecting through an Nx tree
 * ```typescript
 * const packageManager = detectPackageManager((relativePath) => tree.exists(relativePath))
 * ```
 */
export function detectPackageManager(exists: PathExists): PackageManager {
  if (exists('package-lock.json')) {
    return 'npm'
  }
  if (exists('yarn.lock')) {
    return 'yarn'
  }
  if (exists('pnpm-lock.yaml')) {
    return 'pnpm'
  }
  if (exists('bun.lock') || exists('bun.lockb')) {
    return 'bun'
  }
  return 'npm'
}

/**
 * Install the workspace's dependencies with its own package manager.
 *
 * Fallback for workspaces where `@nx/devkit`'s `installPackagesTask` cannot be
 * resolved: detects the package manager from the workspace lockfile and runs
 * its `install` synchronously at the tree root, inheriting stdio so the
 * consumer sees the install output. Run this only after the manifest has been
 * flushed to disk — the package manager reads the on-disk `package.json`.
 *
 * @param tree - The Nx virtual file-system tree for the consumer workspace.
 * @throws {Error} When the install command exits non-zero; the message names the exact command to run manually.
 *
 * @example Installing after the generator's changes are flushed
 * ```typescript
 * installPackages(tree)
 * ```
 */
export function installPackages(tree: Tree): void {
  const packageManager = detectPackageManager((relativePath) => tree.exists(relativePath))
  try {
    execFileSync(packageManager, ['install'], { cwd: tree.root, stdio: 'inherit' })
  } catch {
    throw createError(
      `The ${sdkInfo.packageName} declaration was already written to package.json, but the automatic install failed. Run \`${packageManager} install\` in ${tree.root} to finish installing it.`
    )
  }
}
