import type { Tree } from '../model'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { resolveSdkVersion } from '../../generators/metadata/sdk-version'
import { sdkInfo } from '../../shared/sdk-info'

/** Options controlling how an existing SDK declaration is treated. */
export interface EnsureSdkDependencyOptions {
  /** Keep an existing declaration's range untouched instead of pinning it to the running plugin's version. Defaults to `true`. */
  keepExistingVersions?: boolean
}

/**
 * Read and validate the workspace root `package.json` through the tree.
 *
 * @param tree - The Nx virtual file-system tree the manifest is read from.
 * @returns The parsed manifest object.
 * @throws {Error} When the manifest is missing, not valid JSON, or not a JSON object.
 */
function readRootManifest(tree: Tree): Record<string, unknown> {
  const content = tree.read('package.json', 'utf-8')
  if (content === null) {
    throw createError('Could not find a package.json at the workspace root.')
  }
  let manifest: unknown
  try {
    manifest = parse(content)
  } catch {
    throw createError('The workspace root package.json is not valid JSON.')
  }
  if (typeof manifest !== 'object' || manifest === null || isArray(manifest)) {
    throw createError('The workspace root package.json must contain a JSON object.')
  }
  return <Record<string, unknown>>manifest
}

/**
 * Find the manifest sections that already declare a package.
 *
 * @param manifest - The parsed workspace root manifest.
 * @param packageName - The package name to look for.
 * @returns The section names declaring the package, in manifest-conventional order.
 */
function sectionsDeclaring(manifest: Record<string, unknown>, packageName: string): string[] {
  return ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].filter((section) => {
    const declarations = manifest[section]
    return typeof declarations === 'object' && declarations !== null && packageName in declarations
  })
}

/**
 * Resolve the dependency range to declare for the SDK.
 *
 * @returns A caret range on the running plugin's own version, or `latest` when
 * the plugin's manifest cannot be located.
 */
function pluginVersionRange(): string {
  try {
    return `^${resolveSdkVersion()}`
  } catch {
    // why: `latest` still yields an installable declaration when the running plugin's own manifest cannot be located (unusual embeddings).
    return 'latest'
  }
}

/**
 * Ensure the SDK package is declared in the consumer workspace's root
 * `package.json`.
 *
 * A declaration in any dependency section satisfies the check and is left in
 * its section untouched, so repeat runs are no-ops. When the package is
 * undeclared it is added to `dependencies` (the SDK is a runtime dependency),
 * pinned to a caret range on the running plugin's own version. Passing
 * `keepExistingVersions: false` instead re-pins an existing declaration to
 * that range, in whichever section it already lives. Writes preserve the
 * manifest's key order, 2-space indentation, and trailing newline.
 *
 * All reads and writes go through the tree, so `--dry-run` previews the
 * manifest change without touching the disk.
 *
 * @param tree - The Nx virtual file-system tree for the consumer workspace.
 * @param options - Declaration options; see {@link EnsureSdkDependencyOptions}.
 * @returns `true` when a manifest write was staged; `false` when the existing declaration already satisfied the check.
 * @throws {Error} When the workspace root `package.json` is missing or malformed.
 *
 * @example Declaring the SDK before scaffolding into a workspace
 * ```typescript
 * const changed = ensureSdkDependency(tree, { keepExistingVersions: true })
 * ```
 */
export function ensureSdkDependency(tree: Tree, options: EnsureSdkDependencyOptions): boolean {
  const manifest = readRootManifest(tree)
  const declared = sectionsDeclaring(manifest, sdkInfo.packageName)
  if (declared.length > 0 && (options.keepExistingVersions ?? true)) {
    return false
  }
  const range = pluginVersionRange()
  let updated = manifest
  for (const section of declared.length > 0 ? declared : ['dependencies']) {
    const declarations = <Record<string, unknown>>(updated[section] ?? {})
    updated = { ...updated, [section]: { ...declarations, [sdkInfo.packageName]: range } }
  }
  tree.write('package.json', `${stringify(updated, null, 2)}\n`)
  return true
}
