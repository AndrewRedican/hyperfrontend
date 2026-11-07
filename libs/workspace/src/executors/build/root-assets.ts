/**
 * The files a build copies from the workspace root into every package: the ones the options
 * name that exist there.
 *
 * @module executors/build/root-assets
 */

import type { AssetSpec, PackageJson } from '@hyperfrontend/builder/models'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/** The root asset that travels only with a package that declares `funding`. */
export const FUNDING_ASSET = 'FUNDING.md'

/**
 * The assets copied from the workspace root.
 *
 * @param root - The workspace root, absolute
 * @param names - The files, relative to the root
 * @returns One asset spec per file that exists, the funding file conditional on the package declaring `funding`
 *
 * @example A missing file is skipped, the funding file is conditional
 * ```typescript
 * rootAssetSpecs('/repo', ['LICENSE', 'FUNDING.md', 'NOTICE'])
 * // => [
 * //   { from: '/repo', files: ['LICENSE'] },
 * //   { from: '/repo', files: ['FUNDING.md'], condition: (manifest) => Boolean(manifest.funding) },
 * // ] when /repo has no NOTICE
 * ```
 */
export function rootAssetSpecs(root: string, names: readonly string[]): AssetSpec[] {
  return names
    .filter((name) => existsSync(join(root, name)))
    .map((name) =>
      name === FUNDING_ASSET
        ? { from: root, files: [name], condition: (manifest: PackageJson) => Boolean(manifest.funding) }
        : { from: root, files: [name] }
    )
}
